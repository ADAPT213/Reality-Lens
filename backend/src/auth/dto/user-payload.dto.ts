import { Role } from '../roles.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  warehouseIds: string[];
  zoneIds: string[];
  iat?: number;
  exp?: number;
}

export interface UserPayload extends JwtPayload {
  userId: string;
}
