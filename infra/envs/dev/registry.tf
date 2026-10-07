# Private image repositories, scanned on push, tags immutable, old images expire.

locals {
  apps = toset(["web", "admin", "api"])
}

resource "aws_ecr_repository" "app" {
  for_each             = local.apps
  name                 = "heach/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true # dev only: lets `tofu destroy` remove repositories with images

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 10 most recent images (stays inside the 500 MB free storage)"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}
