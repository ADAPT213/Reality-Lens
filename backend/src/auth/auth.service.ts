import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './dto/user-payload.dto';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const userWithRelations = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        warehouses: { select: { warehouseId: true } },
        zones: { select: { zoneId: true } },
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: userWithRelations.roles.map((r) => r.role),
      warehouseIds: userWithRelations.warehouses.map((w) => w.warehouseId),
      zoneIds: userWithRelations.zones.map((z) => z.zoneId),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiry,
    });

    const refreshToken = await this.generateRefreshToken(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: userWithRelations.roles.map((r) => r.role),
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const tokenHash = await bcrypt.hash(refreshToken, 1);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: { startsWith: tokenHash.substring(0, 20) },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            roles: true,
            warehouses: { select: { warehouseId: true } },
            zones: { select: { zoneId: true } },
          },
        },
      },
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      roles: storedToken.user.roles.map((r) => r.role),
      warehouseIds: storedToken.user.warehouses.map((w) => w.warehouseId),
      zoneIds: storedToken.user.zones.map((z) => z.zoneId),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiry,
    });

    const newRefreshToken = await this.generateRefreshToken(storedToken.user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        firstName: storedToken.user.firstName,
        lastName: storedToken.user.lastName,
        roles: storedToken.user.roles.map((r) => r.role),
      },
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = await bcrypt.hash(refreshToken, 1);
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          tokenHash: { startsWith: tokenHash.substring(0, 20) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        warehouses: {
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
        zones: {
          include: { zone: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.role),
      warehouses: user.warehouses.map((w) => w.warehouse),
      zones: user.zones.map((z) => z.zone),
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: this.refreshTokenExpiry },
    );

    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
