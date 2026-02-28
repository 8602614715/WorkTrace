"""SMTP helper utilities for reminder emails."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def smtp_configured() -> bool:
    """Return True when required SMTP settings are present."""
    return bool(
        os.getenv("SMTP_HOST")
        and os.getenv("SMTP_PORT")
        and os.getenv("SMTP_FROM")
    )


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None) -> bool:
    """Send an email using SMTP. Returns False if not configured or failed."""
    if not smtp_configured():
        return False

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email
    message.attach(MIMEText(text_body, "plain"))
    if html_body:
        message.attach(MIMEText(html_body, "html"))

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port) as smtp:
                if username and password:
                    smtp.login(username, password)
                smtp.sendmail(from_email, [to_email], message.as_string())
            return True

        with smtplib.SMTP(host, port) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            if username and password:
                smtp.login(username, password)
            smtp.sendmail(from_email, [to_email], message.as_string())
        return True
    except Exception as exc:  # pragma: no cover
        print(f"[email_service] Failed to send email to {to_email}: {exc}")
        return False


def send_project_added_notification(
    to_email: str,
    recipient_name: str,
    project_name: str,
    added_by_name: str,
) -> bool:
    """Notify a user that they were added to a project."""
    subject = f"You were added to project: {project_name}"
    text_body = (
        f"Hi {recipient_name},\n\n"
        f"{added_by_name} added you to the project \"{project_name}\" in WorkTrace.\n"
        "Please log in to view project details.\n\n"
        "Regards,\n"
        "WorkTrace"
    )
    html_body = (
        f"<p>Hi {recipient_name},</p>"
        f"<p><strong>{added_by_name}</strong> added you to the project "
        f"<strong>{project_name}</strong> in WorkTrace.</p>"
        "<p>Please log in to view project details.</p>"
        "<p>Regards,<br/>WorkTrace</p>"
    )
    return send_email(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body)
