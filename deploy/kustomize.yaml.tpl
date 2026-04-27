namespace: tech-dashboard

images:
  - name: registry.gitlab.com/bonhams1793/playground/tech-dashboard/tech-dashboard
    newTag: "{{ lookup('env', 'CI_COMMIT_SHORT_SHA') }}"

resources:
  - ../../../tech-dashboard

commonLabels:
  environment: "{{ deploy_env }}"

patches:
  - target:
      group: traefik.io
      kind: IngressRoute
      name: tech-dashboard-ingressroute
    patch: |-
      - op: replace
        path: "/spec/routes/0/match"
        value: Host(`{{ traefik_host }}`) && PathPrefix(`{{ traefik_path }}`)
  - target:
      group: autoscaling
      kind: HorizontalPodAutoscaler
      name: tech-dashboard-api-hpa
    patch: |-
      - op: replace
        path: "/spec/metrics/0/resource/target/averageUtilization"
        value: {{ kubernetes_hpa_cpu_threshold }}
      - op: replace
        path: "/spec/minReplicas"
        value: {{ kubernetes_min_pods }}
      - op: replace
        path: "/spec/maxReplicas"
        value: {{ kubernetes_max_pods }}

configMapGenerator:
- name: tech-dashboard-configmap
  literals:
  - APP_ENV="{{ deploy_env }}"
  - NODE_ENV="production"
  - PORT="3000"
  - LOG_LEVEL="{{ log_level }}"
  - ALLOWED_ORIGINS="{{ allowed_origins }}"
  - RELEASE_ID="{{ lookup('env', 'CI_COMMIT_SHORT_SHA') }}"
  - CI_COMMIT_SHORT_SHA="{{ lookup('env', 'CI_COMMIT_SHORT_SHA') }}"
  - CI_COMMIT_TITLE="{{ lookup('env', 'CI_COMMIT_TITLE') | replace(':','') }}"
  - CI_PIPELINE_ID="{{ lookup('env', 'CI_PIPELINE_ID') }}"
  - CI_PIPELINE_URL="{{ lookup('env', 'CI_PIPELINE_URL') }}"
  - CI_COMMIT_AUTHOR="{{ lookup('env', 'CI_COMMIT_AUTHOR') }}"
  - CI_JOB_STARTED_AT="{{ lookup('env', 'CI_JOB_STARTED_AT') }}"
