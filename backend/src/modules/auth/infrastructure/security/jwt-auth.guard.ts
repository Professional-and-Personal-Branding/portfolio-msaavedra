import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protege rutas del backoffice: exige `Authorization: Bearer <JWT>` válido (401 si no). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
