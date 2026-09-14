{{/*
VYENFITA Helm Chart Helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "vyenfita.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "vyenfita.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vyenfita.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vyenfita.labels" -}}
helm.sh/chart: {{ include "vyenfita.chart" . }}
{{ include "vyenfita.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: vyenfita-platform
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vyenfita.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vyenfita.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "vyenfita.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "vyenfita.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
AI Service - image
*/}}
{{- define "vyenfita.ai.image" -}}
{{- printf "%s/%s:%s" .Values.global.imageRegistry .Values.ai.image.repository .Values.ai.image.tag }}
{{- end }}
