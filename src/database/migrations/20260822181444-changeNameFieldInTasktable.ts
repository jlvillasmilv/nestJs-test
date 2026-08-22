import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeNameFieldInTasktable20260822181444 implements MigrationInterface {
  name = 'ChangeNameFieldInTasktable20260822181444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `renameColumn` conserva el tipo, el default y los datos existentes.
    // (migration:generate detectaría drop + add y perdería los datos).
    await queryRunner.renameColumn('task', 'isDraft', 'is_draft');
    await queryRunner.renameColumn('task', 'isCompleted', 'is_completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('task', 'is_draft', 'isDraft');
    await queryRunner.renameColumn('task', 'is_completed', 'isCompleted');
  }
}
