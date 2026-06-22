"""
CuraLine email service.

Design principles:
- Email failures must NEVER break a booking, approval, or any other flow:
  every public function swallows errors and logs them.
- No SMTP server configured (empty SMTP_HOST) → emails are logged, not sent,
  so local dev works with zero setup.
- TESTING mode → emails are captured in the in-memory OUTBOX for assertions.
"""
import os
import smtplib
from email.message import EmailMessage

from loguru import logger

from settings import settings

# Test-mode capture: list of dicts {to, subject, text}
OUTBOX: list[dict] = []


def is_configured() -> bool:
    return bool(settings.smtp_host.strip())


def mask_email(email: str | None) -> str:
    """Mask an address for logs: 'john.carter@example.com' -> 'j***@example.com'."""
    if not email or "@" not in email:
        return "<redacted>"
    local, _, domain = email.partition("@")
    head = local[0] if local else ""
    return f"{head}***@{domain}"


def send_email(to: str, subject: str, text: str) -> bool:
    """Send a plain-text email. Returns True if sent (or captured), False otherwise.

    Never raises - failures are logged and reported via the return value.
    """
    if not to:
        return False

    if os.environ.get("TESTING") == "True":
        OUTBOX.append({"to": to, "subject": subject, "text": text})
        return True

    if not is_configured():
        logger.info(f"[EMAIL disabled - no SMTP_HOST] To: {mask_email(to)} | Subject: {subject}")
        return False

    try:
        msg = EmailMessage()
        msg["From"] = settings.email_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(text)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {mask_email(to)} ({subject}): {exc}")
        return False


def queue_email(to: str, subject: str, text: str) -> None:
    """Dispatch an email through Celery when the broker is up; fall back to a
    synchronous send otherwise. Never raises."""
    if os.environ.get("TESTING") == "True":
        send_email(to, subject, text)
        return
    try:
        from tasks.email_tasks import send_email_task
        send_email_task.delay(to, subject, text)
    except Exception as exc:
        logger.warning(f"Email broker unavailable, sending inline: {exc}")
        send_email(to, subject, text)


SIGNATURE = "\n\n- The CuraLine Team\nThis is an automated message; please do not reply."


# ── Templates ────────────────────────────────────────────────────────


def application_received(to: str, doctor_name: str) -> None:
    queue_email(
        to,
        "We received your CuraLine application",
        f"Hello {doctor_name},\n\n"
        "Thank you for applying to practice on CuraLine. Our team will verify "
        "your medical license and qualifications. You'll receive another email "
        "as soon as your application is reviewed - you will not be able to sign "
        "in until then." + SIGNATURE,
    )


def application_approved(to: str, doctor_name: str) -> None:
    queue_email(
        to,
        "Your CuraLine application has been approved",
        f"Hello {doctor_name},\n\n"
        "Great news - your credentials have been verified and your CuraLine "
        "account is now active. You can sign in to the doctor portal, set up "
        "your schedule, and start receiving patients.\n\n"
        "Tip: open Settings after your first sign-in to set a password only "
        "you know." + SIGNATURE,
    )


def application_rejected(to: str, doctor_name: str) -> None:
    queue_email(
        to,
        "Update on your CuraLine application",
        f"Hello {doctor_name},\n\n"
        "After reviewing your application we are unable to approve it at this "
        "time. If you believe this is an error or can provide additional "
        "credentials, please contact the hospital administration." + SIGNATURE,
    )


def appointment_confirmed(to: str, patient_name: str, doctor_name: str, slot_info: str) -> None:
    queue_email(
        to,
        "Your CuraLine appointment is confirmed",
        f"Hello {patient_name},\n\n"
        f"Your appointment is booked:\n\n"
        f"  Doctor: {doctor_name}\n"
        f"  When:   {slot_info}\n\n"
        "Please arrive 10 minutes early. You can view or cancel this "
        "appointment any time from your CuraLine dashboard." + SIGNATURE,
    )


def appointment_cancelled(to: str, patient_name: str, doctor_name: str, slot_info: str) -> None:
    queue_email(
        to,
        "Your CuraLine appointment was cancelled",
        f"Hello {patient_name},\n\n"
        f"Your appointment with {doctor_name} on {slot_info} has been "
        "cancelled and the slot has been released. You can book a new "
        "appointment any time." + SIGNATURE,
    )


def appointment_reminder(to: str, patient_name: str, doctor_name: str, slot_info: str) -> None:
    queue_email(
        to,
        "Reminder: your CuraLine appointment is tomorrow",
        f"Hello {patient_name},\n\n"
        f"A friendly reminder about your upcoming appointment:\n\n"
        f"  Doctor: {doctor_name}\n"
        f"  When:   {slot_info}\n\n"
        "Please arrive 10 minutes early. If you can't make it, cancel from "
        "your dashboard so another patient can use the slot." + SIGNATURE,
    )


def doctor_invite(to: str, doctor_name: str, invite_link: str) -> None:
    queue_email(
        to,
        "You're invited to practice on CuraLine",
        f"Hello {doctor_name},\n\n"
        "Hospital administration has set up a CuraLine doctor account for you. "
        "Click the link below to choose your password and activate your portal "
        "access (the link expires in 7 days and can be used once):\n\n"
        f"  {invite_link}\n\n"
        "Once activated you can manage your schedule, see your severity-triaged "
        "day, and record visit outcomes." + SIGNATURE,
    )


def verify_email(to: str, name: str, verify_link: str) -> None:
    queue_email(
        to,
        "Verify your CuraLine email",
        f"Hello {name},\n\n"
        "Welcome to CuraLine. Please confirm this is your email address by "
        "clicking the link below (it expires in 24 hours):\n\n"
        f"  {verify_link}\n\n"
        "If you didn't create a CuraLine account, you can safely ignore this "
        "message." + SIGNATURE,
    )


def password_reset(to: str, name: str, reset_link: str) -> None:
    queue_email(
        to,
        "Reset your CuraLine password",
        f"Hello {name},\n\n"
        "We received a request to reset your CuraLine password. Click the link "
        "below to choose a new one (it expires in 1 hour and can be used once):\n\n"
        f"  {reset_link}\n\n"
        "If you didn't request this, you can ignore this email - your password "
        "won't change." + SIGNATURE,
    )


def reschedule_requested(to: str, patient_name: str, proposed_slot_info: str) -> None:
    queue_email(
        to,
        "CuraLine: a critical patient needs your time slot",
        f"Hello {patient_name},\n\n"
        "A patient with an urgent condition needs an earlier appointment, and "
        "your slot is the best match. You are being asked - not required - to "
        f"switch to this slot instead:\n\n  {proposed_slot_info}\n\n"
        "Please open the Reschedule page in your CuraLine dashboard to accept "
        "or decline. Your appointment stays unchanged unless you accept." + SIGNATURE,
    )
