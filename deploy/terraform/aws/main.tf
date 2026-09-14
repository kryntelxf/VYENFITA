# ============================================================
# VYENFITA AWS Infrastructure
# ============================================================
# Provisions:
# - VPC with public/private subnets
# - EKS cluster
# - RDS PostgreSQL
# - ElastiCache Redis
# - S3 bucket for artifacts
# - IAM roles
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure these per environment
    # bucket = "vyenfita-terraform-state"
    # key    = "aws/prod/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VYENFITA"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================================
# VARIABLES
# ============================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "vyenfita-cluster"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# ============================================================
# VPC
# ============================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.cluster_name}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# ============================================================
# EKS CLUSTER
# ============================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    main = {
      min_size       = 2
      max_size       = 10
      desired_size   = 3
      instance_types = ["t3.medium"]
      
      labels = {
        role = "worker"
      }
    }
  }

  # Enable cluster access for current IAM user
  enable_cluster_creator_admin_permissions = true

  tags = {
    Environment = var.environment
  }
}

# ============================================================
# RDS POSTGRESQL
# ============================================================

resource "aws_db_subnet_group" "vyenfita" {
  name       = "${var.cluster_name}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "${var.cluster_name}-db-subnet"
  }
}

resource "aws_security_group" "vyenfita_db" {
  name_prefix = "${var.cluster_name}-db-"
  description = "Security group for VYENFITA PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cluster_name}-db-sg"
  }
}

resource "aws_db_instance" "vyenfita" {
  identifier = "${var.cluster_name}-db"

  engine         = "postgres"
  engine_version = "16.2"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 3
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "vyenfita"
  username = "vyenfita"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.vyenfita.name
  vpc_security_group_ids = [aws_security_group.vyenfita_db.id]

  backup_retention_period   = 30
  backup_window             = "03:00-04:00"
  maintenance_window        = "sun:04:00-sun:05:00"
  final_snapshot_identifier = "${var.cluster_name}-final-snapshot-${formatdate("YYYY-MM-DD", timestamp())}"

  deletion_protection      = true
  skip_final_snapshot      = false
  copy_tags_to_snapshot    = true

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn

  tags = {
    Name = "${var.cluster_name}-db"
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${var.cluster_name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ============================================================
# ELASTICACHE REDIS
# ============================================================

resource "aws_elasticache_subnet_group" "vyenfita" {
  name       = "${var.cluster_name}-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "vyenfita_redis" {
  name_prefix = "${var.cluster_name}-redis-"
  description = "Security group for VYENFITA Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from EKS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "vyenfita" {
  replication_group_id       = "${var.cluster_name}-redis"
  replication_group_description = "VYENFITA Redis cluster"
  
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.vyenfita.name
  security_group_ids = [aws_security_group.vyenfita_redis.id]

  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window          = "03:00-05:00"

  tags = {
    Name = "${var.cluster_name}-redis"
  }
}

# ============================================================
# S3 BUCKET FOR ARTIFACTS
# ============================================================

resource "aws_s3_bucket" "vyenfita_artifacts" {
  bucket = "${var.cluster_name}-artifacts"

  tags = {
    Name = "${var.cluster_name}-artifacts"
  }
}

resource "aws_s3_bucket_versioning" "vyenfita_artifacts" {
  bucket = aws_s3_bucket.vyenfita_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vyenfita_artifacts" {
  bucket = aws_s3_bucket.vyenfita_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "vyenfita_artifacts" {
  bucket = aws_s3_bucket.vyenfita_artifacts.id

  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ============================================================
# OUTPUTS
# ============================================================

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "database_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.vyenfita.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.vyenfita.primary_endpoint_address
  sensitive   = true
}

output "artifacts_bucket" {
  description = "S3 artifacts bucket"
  value       = aws_s3_bucket.vyenfita_artifacts.bucket
}
