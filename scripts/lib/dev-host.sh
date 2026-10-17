# Shared by scripts/dev-sleep and scripts/dev-wake. Finds the dev host by its tags.
REGION=ap-south-1

dev_instance_id() {
  local state="$1" id
  id=$(aws ec2 describe-instances --region "$REGION" \
    --filters Name=tag:Project,Values=heach Name=tag:Environment,Values=dev \
    Name=instance-state-name,Values="$state" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)
  [ "$id" = None ] || echo "$id"
}
