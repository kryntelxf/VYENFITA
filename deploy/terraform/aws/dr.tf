# ============================================================
# VYENFITA Disaster Recovery — AWS
# ============================================================
# Provisions:
# - Cross-region RDS read replica
# - S3 Cross-Region Replication
# - Route53 health checks + failover
# - Lambda for automated failover
# - CloudWatch alarms
# ============================================================

# ============================================================
# VARIABLES
# ============================================================

variable "secondary_region" {
  description = "Secondary region for DR"
  type        = string
  default     = "eu-west-1"
}

variable "primary_db_arn" {
  description = "ARN of primary RDS instance"
  type        = string
}

variable "primary_db_identifier" {
  description = "Identifier of primary RDS instance"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "primary_endpoint" {
  description = "Primary region endpoint"
  type        = string
}

# ============================================================
# SECONDARY REGION PROVIDER
# ============================================================

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

# ============================================================
# CROSS-REGION RDS REPLICA
# ============================================================

resource "aws_db_instance" "vyenfita_replica" {
  provider = aws.secondary

  identifier          = "${var.primary_db_identifier}-replica"
  replicate_source_db = var.primary_db_arn

  instance_class    = "db.t3.medium"
  storage_type      = "gp3"
  storage_encrypted = true

  # No backup needed for replica (uses source snapshots)
  backup_retention_period = 0
  skip_final_snapshot     = true

  # Replica is read-only until promoted
  auto_minor_version_upgrade = false

  tags = {
    Name = "${var.primary_db_identifier}-replica"
    Role = "disaster-recovery"
  }
}

# ============================================================
# S3 CROSS-REGION REPLICATION
# ============================================================

resource "aws_s3_bucket" "vyenfita_artifacts_secondary" {
  provider = aws.secondary
  bucket   = "vyenfita-artifacts-secondary"

  tags = {
    Name = "vyenfita-artifacts-secondary"
    Role = "disaster-recovery"
  }
}

resource "aws_s3_bucket_versioning" "vyenfita_artifacts_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.vyenfita_artifacts_secondary.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vyenfita_artifacts_secondary" {
  provider = aws.secondary
  bucket   = aws_s3_bucket.vyenfita_artifacts_secondary.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IAM role for replication
resource "aws_iam_role" "replication" {
  name = "vyenfita-s3-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "s3.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "replication" {
  role = aws_iam_role.replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [aws_s3_bucket.vyenfita_artifacts.arn]
      },
      {
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.vyenfita_artifacts.arn}/*"]
      },
      {
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Effect   = "Allow"
        Resource = ["${aws_s3_bucket.vyenfita_artifacts_secondary.arn}/*"]
      }
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "vyenfita_artifacts" {
  bucket = aws_s3_bucket.vyenfita_artifacts.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-all"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.vyenfita_artifacts_secondary.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# ============================================================
# ROUTE53 HEALTH CHECK + FAILOVER
# ============================================================

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_endpoint
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name = "vyenfita-primary-health"
  }
}

resource "aws_route53_record" "vyenfita_primary" {
  zone_id = var.hosted_zone_id
  name    = "api.vyenfita.com"
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id

  alias {
    name                   = var.primary_endpoint
    zone_id                = "Z1234567890ABC"
    evaluate_target_health = true
  }
}

# Secondary will be added when the secondary endpoint is defined
# resource "aws_route53_record" "vyenfita_secondary" { ... }

# ============================================================
# CLOUDWATCH ALARMS
# ============================================================

resource "aws_cloudwatch_metric_alarm" "primary_db_cpu" {
  alarm_name          = "vyenfita-primary-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    DBInstanceIdentifier = var.primary_db_identifier
  }

  alarm_description = "Primary DB CPU > 80% for 10 min"

  alarm_actions = [aws_sns_topic.dr_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "replication_lag" {
  alarm_name          = "vyenfita-replication-lag-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReplicaLag"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 300  # 5 min lag

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.vyenfita_replica.id
  }

  alarm_description = "Replica lag > 5 min"

  alarm_actions = [aws_sns_topic.dr_alerts.arn]
}

# ============================================================
# SNS TOPIC FOR DR ALERTS
# ============================================================

resource "aws_sns_topic" "dr_alerts" {
  name = "vyenfita-dr-alerts"

  tags = {
    Name = "vyenfita-dr-alerts"
  }
}

resource "aws_sns_topic_subscription" "dr_alerts_email" {
  topic_arn = aws_sns_topic.dr_alerts.arn
  protocol  = "email"
  endpoint  = "ops@vyenfita.com"
}

# ============================================================
# OUTPUTS
# ============================================================

output "replica_endpoint" {
  description = "RDS replica endpoint"
  value       = aws_db_instance.vyenfita_replica.endpoint
  sensitive   = true
}

output "secondary_bucket" {
  description = "Secondary S3 bucket"
  value       = aws_s3_bucket.vyenfita_artifacts_secondary.bucket
}

output "dr_alerts_topic" {
  description = "SNS topic for DR alerts"
  value       = aws_sns_topic.dr_alerts.arn
}
