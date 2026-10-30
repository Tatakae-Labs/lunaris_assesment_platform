import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any
from app.core.config import settings

def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends an email using configured SMTP parameters from .env.
    If SMTP credentials are not configured or in local development mode without a live SMTP host,
    simulates delivery gracefully and logs the message details without raising exceptions.
    """
    from_address = settings.SMTP_FROM_EMAIL
    from_name = settings.SMTP_FROM_NAME or "Lunaris Assessment Platform"
    formatted_from = f"{from_name} <{from_address}>"

    # Check if SMTP user and password are provided
    is_live_configured = bool(
        settings.SMTP_USER 
        and settings.SMTP_PASSWORD 
        and settings.SMTP_PASSWORD != "your_smtp_app_password_here"
    )

    if not is_live_configured:
        print(f"\n=======================================================")
        print(f"[LUNARIS MAILER - DEV / SIMULATION MODE]")
        print(f"To: {to_email}")
        print(f"From: {formatted_from}")
        print(f"Subject: {subject}")
        print(f"Notice: Set SMTP_USER and SMTP_PASSWORD in .env for live transmission.")
        print(f"=======================================================\n")
        return {
            "success": True,
            "status": "simulated",
            "message": f"Email to {to_email} simulated successfully (configure live SMTP in .env for live delivery)."
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formatted_from
        msg["To"] = to_email

        plain_text = text_content or html_content.replace("<br>", "\n").replace("</p>", "\n\n")
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_SSL:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_address, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_TLS:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(from_address, [to_email], msg.as_string())

        return {
            "success": True,
            "status": "delivered",
            "message": f"Email successfully delivered to {to_email}."
        }
    except Exception as exc:
        print(f"[LUNARIS MAILER ERROR] Failed to send email to {to_email}: {exc}")
        return {
            "success": False,
            "status": "failed",
            "error": str(exc)
        }

def send_organization_invite_email(
    to_email: str,
    org_name: str,
    invite_code: str,
    inviter_name: str
) -> Dict[str, Any]:
    """
    Sends an invitation email to a candidate/author invited to an organization by the owner.
    """
    subject = f"You're invited to join {org_name} on Lunaris"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
          <div style="width: 32px; height: 32px; background: #2563eb; color: #ffffff; border-radius: 6px; text-align: center; line-height: 32px; font-weight: 900; font-size: 16px;">L</div>
          <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">LUNARIS</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0;">Organization Invitation</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          <strong>{inviter_name}</strong> has invited your email address (<strong>{to_email}</strong>) to collaborate on examinations and candidate assessments at <strong>{org_name}</strong>.
        </p>
        
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin: 24px 0; text-align: center;">
          <div style="font-size: 12px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Organization Invite Code</div>
          <div style="font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 2px; color: #1d4ed8;">{invite_code}</div>
        </div>

        <p style="font-size: 13px; color: #475569; line-height: 1.6;">
          <strong>How to Join:</strong>
          <ol style="padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.8;">
            <li>Visit the Lunaris platform registration page.</li>
            <li>Select <strong>"Join Existing Organization"</strong>.</li>
            <li>Enter your invite code <strong>{invite_code}</strong> and your email <strong>{to_email}</strong>.</li>
            <li>Set your password to activate your account.</li>
          </ol>
        </p>

        <p style="font-size: 12px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          This invitation was sent specifically to {to_email}. Only this verified email address can accept this invite.
        </p>
      </div>
    </body>
    </html>
    """
    return send_email(to_email=to_email, subject=subject, html_content=html)

def send_welcome_joined_org_email(
    to_email: str,
    org_name: str,
    full_name: str,
    role: str
) -> Dict[str, Any]:
    """
    Sends a confirmation email after an invited user successfully registers and joins an organization.
    """
    subject = f"Welcome to {org_name} on Lunaris"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 32px;">
        <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0;">Welcome, {full_name}!</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          Your account is now active and successfully connected to <strong>{org_name}</strong> as <strong>{role.replace('_', ' ').title()}</strong>.
        </p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          You can now log in to your workspace dashboard to create questions, manage examinations, and review results.
        </p>
        <div style="margin-top: 24px;">
          <a href="http://localhost:5173/login" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
            Access Workspace Dashboard →
          </a>
        </div>
      </div>
    </body>
    </html>
    """
    return send_email(to_email=to_email, subject=subject, html_content=html)
