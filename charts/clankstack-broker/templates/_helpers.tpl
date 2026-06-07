{{- define "clankstack-broker.name" -}}
{{- default "clankstack-broker" .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "clankstack-broker.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "clankstack-broker.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "clankstack-broker.labels" -}}
app.kubernetes.io/name: {{ include "clankstack-broker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "clankstack-broker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "clankstack-broker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "clankstack-broker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "clankstack-broker.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "clankstack-broker.secretName" -}}
{{- if .Values.broker.existingSecret -}}
{{- .Values.broker.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "clankstack-broker.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "clankstack-broker.postgresHost" -}}
{{- printf "%s-postgres" (include "clankstack-broker.fullname" .) -}}
{{- end -}}
