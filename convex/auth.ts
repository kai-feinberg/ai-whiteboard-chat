import { convexAuth } from "@convex-dev/auth/server";
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Resend({
    from: "Exodus-Auth <auth@auth.kaifeinberg.dev>",
    apiKey: process.env.AUTH_RESEND_KEY,
    async sendVerificationRequest({ identifier: email, provider, url }) {
      const resend = new ResendAPI(provider.apiKey);
      const { error } = await resend.emails.send({
        from: provider.from as string,
        to: [email],
        subject: `Sign in to AdScout`,
        text: `Click the link below to sign in to AdScout:\n\n${url}\n\nThis link will expire in 24 hours.`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(to bottom, #f8f9fa, #e9ecef); padding: 30px; border-radius: 10px 10px 0 0; text-align: center; border: 1px solid #dee2e6; border-bottom: none; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h1 style="color: #212529; margin: 0; font-size: 28px; font-weight: 700;">AdScout</h1>
              </div>
              <div style="background: #ffffff; padding: 40px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <h2 style="color: #212529; margin-top: 0; font-weight: 600;">Sign in to your account</h2>
                <p style="color: #495057; font-size: 16px;">Click the button below to securely sign in to AdScout:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="display: inline-block; background: linear-gradient(to bottom, #6c757d, #495057); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">Sign In</a>
                </div>
                <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours. If you didn't request this email, you can safely ignore it.</p>
                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                <p style="color: #adb5bd; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} AdScout. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        throw new Error(JSON.stringify(error));
      }
    },
  })
  ],
});
