/**
 * AdminModule — privileged endpoints under `/admin/*`.
 *
 * All controllers here carry @Roles('admin'). JwtAuthGuard runs first
 * (via APP_GUARD in AuthModule), then RolesGuard enforces role=admin,
 * so no public or role-less routes leak out of this module.
 */
import { Module } from '@nestjs/common';
import { CasesAdminController } from './cases-admin.controller';
import { FacilitiesAdminController } from './facilities-admin.controller';
import { PatientsAdminController } from './patients-admin.controller';

@Module({
  controllers: [
    FacilitiesAdminController,
    PatientsAdminController,
    CasesAdminController,
  ],
})
export class AdminModule {}
