import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(email: string, name: string, url: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Verifica tu cuenta',
      template: 'verification', // Nombre del archivo .hbs sin extensión
      context: { name, url },
    });
  }

  async sendResetPassword(email: string, name: string, url: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Recuperar contraseña',
      template: 'reset-password',
      context: { name, url },
    });
  }
}
