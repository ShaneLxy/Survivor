import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlayerSave } from '../../save/entities/player-save.entity';

@Entity('user_accounts')
export class UserAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  account: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 32, default: 'local' })
  loginType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nickname: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  wechatOpenId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  wechatUnionId: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => PlayerSave, (playerSave) => playerSave.account)
  playerSave: PlayerSave;
}
