# One public subnet, no NAT gateway (cost). The host is reachable only on the ports below;
# administration is through SSM Session Manager, never SSH (SO-06).

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, 1)
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "${var.name}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Lock down the VPC's default security group so nothing uses it by accident.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id
}

resource "aws_security_group" "host" {
  name        = "${var.name}-host"
  description = "HEACH app host: HTTPS for web and API; admin only from allow-listed ranges"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  security_group_id = aws_security_group.host.id
  description       = "Web (HTTPS)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "api" {
  security_group_id = aws_security_group.host.id
  description       = "API (HTTPS)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 9443
  to_port           = 9443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "admin" {
  for_each          = toset(var.admin_allowed_cidrs)
  security_group_id = aws_security_group.host.id
  description       = "Admin (HTTPS), allow-listed (SE-04)"
  cidr_ipv4         = each.value
  from_port         = 8443
  to_port           = 8443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.host.id
  description       = "Outbound: image pulls, OS updates, SSM"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
