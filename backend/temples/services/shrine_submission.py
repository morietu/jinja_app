from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from temples.models import Shrine, ShrineSubmission


User = get_user_model()


class ShrineSubmissionError(Exception):
    pass


class ShrineSubmissionDuplicateError(ShrineSubmissionError):
    pass


class ShrineSubmissionInvalidStateError(ShrineSubmissionError):
    pass


@dataclass(frozen=True)
class DuplicateCheckResult:
    exists_in_shrine: bool
    exists_in_pending_submission: bool


def has_duplicate_shrine(*, name: str, address: str) -> bool:
    normalized_name = (name or "").strip()
    normalized_address = (address or "").strip()
    if not normalized_name or not normalized_address:
        return False

    return Shrine.objects.filter(
        name_jp=normalized_name,
        address=normalized_address,
    ).exists()


def has_duplicate_pending_submission(
    *,
    name: str,
    address: str,
    exclude_submission_id: int | None = None,
) -> bool:
    normalized_name = (name or "").strip()
    normalized_address = (address or "").strip()
    if not normalized_name or not normalized_address:
        return False

    qs = ShrineSubmission.objects.filter(
        name=normalized_name,
        address=normalized_address,
        status=ShrineSubmission.Status.PENDING,
    )
    if exclude_submission_id is not None:
        qs = qs.exclude(pk=exclude_submission_id)
    return qs.exists()


def check_submission_duplicates(
    *,
    name: str,
    address: str,
    exclude_submission_id: int | None = None,
) -> DuplicateCheckResult:
    return DuplicateCheckResult(
        exists_in_shrine=has_duplicate_shrine(name=name, address=address),
        exists_in_pending_submission=has_duplicate_pending_submission(
            name=name,
            address=address,
            exclude_submission_id=exclude_submission_id,
        ),
    )


@transaction.atomic
def approve_shrine_submission(
    *,
    submission_id: int,
    reviewer: User,
) -> Shrine:
    submission = ShrineSubmission.objects.select_for_update().get(pk=submission_id)

    if submission.status != ShrineSubmission.Status.PENDING:
        raise ShrineSubmissionInvalidStateError(
            f"pending 以外は承認できません: submission_id={submission.id}, status={submission.status}"
        )

    duplicate = check_submission_duplicates(
        name=submission.name,
        address=submission.address,
        exclude_submission_id=submission.id,
    )

    if duplicate.exists_in_shrine:
        raise ShrineSubmissionDuplicateError(
            f"既存 Shrine と重複しています: name={submission.name}, address={submission.address}"
        )

    shrine = Shrine.objects.create(
        name_jp=submission.name.strip(),
        address=submission.address.strip(),
        latitude=submission.lat,
        longitude=submission.lng,
        owner=submission.user,
    )

    submission.status = ShrineSubmission.Status.APPROVED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = reviewer
    submission.save(
        update_fields=[
            "status",
            "reviewed_at",
            "reviewed_by",
            "updated_at",
        ]
    )

    return shrine


@transaction.atomic
def reject_shrine_submission(
    *,
    submission_id: int,
    reviewer: User,
    review_comment: str = "",
) -> ShrineSubmission:
    submission = ShrineSubmission.objects.select_for_update().get(pk=submission_id)

    submission.status = ShrineSubmission.Status.REJECTED
    submission.reviewed_at = timezone.now()
    submission.reviewed_by = reviewer

    if review_comment:
        submission.review_comment = review_comment

    submission.save(
        update_fields=[
            "status",
            "reviewed_at",
            "reviewed_by",
            "review_comment",
            "updated_at",
        ]
    )
    return submission
