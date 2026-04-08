import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserAccount } from '../../users/entities/user-account.entity';

@Entity('player_saves')
export class PlayerSave {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  accountId: number;

  @OneToOne(() => UserAccount, (account) => account.playerSave, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: UserAccount;

  @Column({ type: 'varchar', length: 16, default: '2.0.0' })
  version: string;

  @Column({ type: 'simple-json', nullable: true })
  saveData: Record<string, any> | null;

  @Column({ type: 'bigint', default: 0 })
  lastSaveTime: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
