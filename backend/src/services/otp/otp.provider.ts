export interface IOtpProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}

export class MockOtpProvider implements IOtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_OTP_LOGS === 'true') {
      console.log(`[DEMO OTP PROVIDER] Sent OTP ${otp} to phone ${phone}`);
    }
  }
}

// Export singleton instance for easy dependency injection/swapping
export const otpProvider: IOtpProvider = new MockOtpProvider();
