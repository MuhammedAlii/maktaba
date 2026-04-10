/**
 * Email gönderim servisi (EmailJS kullanır)
 * Yapılandırma için .env dosyasına ekleyin:
 * VITE_EMAILJS_SERVICE_ID=service_xxx
 * VITE_EMAILJS_TEMPLATE_ID=template_xxx
 * VITE_EMAILJS_PUBLIC_KEY=your_public_key
 *
 * EmailJS template'inde {{code}} ve {{email}} değişkenleri kullanın.
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EMAILJS_NOT_CONFIGURED');
  }

  const { default: emailjs } = await import('@emailjs/browser');

  const logoUrl = import.meta.env.VITE_APP_LOGO_URL || '';

  await emailjs.send(serviceId, templateId, {
    to_email: email,
    email,
    code,
    reply_to: email,
    logo_url: logoUrl,
  }, publicKey);
}
