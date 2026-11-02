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

def send_registration_otp_email(
    to_email: str,
    otp_code: str,
    full_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends a 6-digit email verification OTP to activate account registration.
    """
    greeting = f"Hello {full_name}," if full_name else "Hello,"
    subject = f"Your Lunaris Verification Code: {otp_code}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 32px; height: 32px; background: #2563eb; color: #ffffff; border-radius: 6px; text-align: center; line-height: 32px; font-weight: 900; font-size: 16px;">L</div>
          <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a;">LUNARIS</span>
        </div>

        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Verify Your Email Address</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          {greeting}<br/>
          Thank you for signing up with Lunaris. Please use the 6-digit verification code below to verify your email address and activate your workspace registration:
        </p>

        <div style="background: #f0f9ff; border: 2px dashed #38bdf8; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">6-Digit Verification Code</div>
          <div style="font-size: 32px; font-weight: 900; font-family: monospace; letter-spacing: 8px; color: #0284c7;">{otp_code}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Valid for 10 minutes</div>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
          Security Notice: Never share this verification code with anyone. Lunaris representatives will never ask for your code.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If you did not initiate this account registration on Lunaris, you can safely disregard this email.
        </p>
      </div>
    </body>
    </html>
    """
    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_subscription_renewal_reminder_email(
    to_email: str,
    org_name: str,
    plan_name: str,
    days_remaining: int,
    renewal_date_str: str,
    amount_inr: int
) -> Dict[str, Any]:
    """
    Sends an upcoming monthly renewal reminder to the organization owner.
    """
    urgency = "Reminder" if days_remaining > 3 else "Action Required"
    subject = f"[{urgency}] Your {plan_name} plan for {org_name} renews in {days_remaining} day{'s' if days_remaining != 1 else ''}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 32px; height: 32px; background: #2563eb; color: #ffffff; border-radius: 6px; text-align: center; line-height: 32px; font-weight: 900; font-size: 16px;">L</div>
          <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a;">LUNARIS</span>
        </div>

        <div style="display: inline-block; padding: 4px 12px; background: {'#fffbeb' if days_remaining > 3 else '#fef2f2'}; color: {'#b45309' if days_remaining > 3 else '#b91c1c'}; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
          ⏱️ Renews in {days_remaining} Day{'s' if days_remaining != 1 else ''}
        </div>

        <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 10px;">Monthly Subscription Renewal Reminder</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          Hello from the Lunaris Assessment team,<br/><br/>
          This is a friendly reminder that the <strong>{plan_name}</strong> monthly subscription for your organization <strong>{org_name}</strong> is scheduled to renew on <strong>{renewal_date_str}</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
            <span style="color: #64748b;">Organization:</span>
            <strong style="color: #0f172a;">{org_name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
            <span style="color: #64748b;">Current Tier:</span>
            <strong style="color: #2563eb;">{plan_name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
            <span style="color: #64748b;">Renewal Date:</span>
            <strong style="color: #0f172a;">{renewal_date_str}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 15px;">
            <span style="font-weight: 700; color: #0f172a;">Renewal Amount:</span>
            <strong style="color: #059669; font-size: 17px;">₹{amount_inr:,} / month</strong>
          </div>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="http://localhost:5173/dashboard?tab=billing" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            Renew Subscription via UPI Gateway →
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
          🔒 <strong>Why renew on time?</strong> Timely renewal ensures zero downtime for your active assessments, preserves your AI question synthesis credits, and keeps proctored candidate quotas uninterrupted.
        </p>

        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Need assistance or custom enterprise billing? Reply directly to this email or reach out to support@lunaris.com.
        </p>
      </div>
    </body>
    </html>
    """
    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_subscription_expired_email(
    to_email: str,
    org_name: str,
    plan_name: str,
    amount_inr: int,
    grace_period_days: int = 3
) -> Dict[str, Any]:
    """
    Sends notice when a monthly subscription has reached its renewal date and entered grace period.
    """
    subject = f"[Action Required] Your {plan_name} plan for {org_name} has expired (Grace Period Active)"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 32px; height: 32px; background: #2563eb; color: #ffffff; border-radius: 6px; text-align: center; line-height: 32px; font-weight: 900; font-size: 16px;">L</div>
          <span style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px; color: #0f172a;">LUNARIS</span>
        </div>

        <div style="display: inline-block; padding: 4px 12px; background: #fef2f2; color: #b91c1c; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
          ⚠️ Subscription Period Ended
        </div>

        <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 10px;">Your Subscription Has Expired</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          The monthly period for <strong>{org_name}</strong>'s <strong>{plan_name}</strong> plan ended today. 
          A temporary <strong>{grace_period_days}-day grace period</strong> has been activated so your students can continue ongoing tests without disruption.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="http://localhost:5173/dashboard?tab=billing" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            Renew Now (₹{amount_inr:,} / mo) →
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
          ⚠️ If not renewed within {grace_period_days} days, the workspace will automatically downgrade to the Free Starter tier with limited proctoring and quotas.
        </p>
      </div>
    </body>
    </html>
    """
    return send_email(to_email=to_email, subject=subject, html_content=html)
