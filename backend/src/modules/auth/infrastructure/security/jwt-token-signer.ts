import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../../../../config/configuration';
import { SignedToken, TokenClaims, TokenSigner } from '../../domain/ports/token-signer.port';

/** Emite JWT HS256 firmados con JWT_SECRET y caducidad JWT_EXPIRES_IN. */
@Injectable()
export class JwtTokenSigner implements TokenSigner {
  private readonly expiresInSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.expiresInSeconds = config.getOrThrow<AppConfig>(APP_CONFIG).jwt.expiresInSeconds;
  }

  async sign(claims: TokenClaims): Promise<SignedToken> {
    const token = await this.jwt.signAsync(
      { email: claims.email, name: claims.name },
      { subject: claims.sub, expiresIn: this.expiresInSeconds },
    );
    return { token, expiresInSeconds: this.expiresInSeconds };
  }
}
