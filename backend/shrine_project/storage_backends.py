from storages.backends.s3boto3 import S3Boto3Storage

class R2MediaStorage(S3Boto3Storage):
    location = ""          # 必要なら "media" にしてもOK
    default_acl = None
    file_overwrite = False
