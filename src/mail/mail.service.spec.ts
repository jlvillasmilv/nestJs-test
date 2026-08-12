import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  const mockMailerService = {
    sendMail: jest.fn<Promise<void>, [options: unknown]>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMailerService.sendMail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendResetPassword', () => {
    it('envía el correo con la plantilla reset-password y su contexto', async () => {
      await service.sendResetPassword(
        'user@example.com',
        'juan',
        'http://localhost:3000/reset?token=abc',
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Recuperar contraseña',
        template: 'reset-password',
        context: {
          name: 'juan',
          url: 'http://localhost:3000/reset?token=abc',
        },
      });
    });
  });

  describe('sendUserConfirmation', () => {
    it('envía el correo con la plantilla verification y su contexto', async () => {
      await service.sendUserConfirmation(
        'user@example.com',
        'juan',
        'http://localhost:3000/verify?token=abc',
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Verifica tu cuenta',
        template: 'verification',
        context: {
          name: 'juan',
          url: 'http://localhost:3000/verify?token=abc',
        },
      });
    });
  });
});
