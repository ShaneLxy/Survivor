import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAccount } from '../users/entities/user-account.entity';
import { UpsertSaveDto } from './dto/upsert-save.dto';
import { PlayerSave } from './entities/player-save.entity';

@Injectable()
export class SaveService {
  constructor(
    @InjectRepository(PlayerSave)
    private readonly saveRepository: Repository<PlayerSave>,
  ) {}

  async getSaveByAccountId(accountId: number) {
    const save = await this.saveRepository.findOne({ where: { accountId } });
    if (!save?.saveData) {
      return {
        success: true,
        message: '云端暂无存档',
        saveData: null,
      };
    }

    return {
      success: true,
      message: '获取云存档成功',
      saveData: {
        version: save.version,
        timestamp: save.lastSaveTime,
        data: save.saveData,
      },
    };
  }

  async upsertSave(user: UserAccount, dto: UpsertSaveDto) {
    const wrapper = dto.saveData || {};
    const data = wrapper.data || {};
    const lastSaveTime = Number(data.lastSaveTime || wrapper.timestamp || Date.now());

    let save = await this.saveRepository.findOne({ where: { accountId: user.id } });
    if (!save) {
      save = this.saveRepository.create({
        accountId: user.id,
        account: user,
      });
    }

    save.version = wrapper.version || '2.0.0';
    save.lastSaveTime = lastSaveTime;
    save.saveData = data;
    await this.saveRepository.save(save);

    return {
      success: true,
      message: '云存档保存成功',
      saveData: {
        version: save.version,
        timestamp: save.lastSaveTime,
        data: save.saveData,
      },
    };
  }

  async deleteSave(accountId: number) {
    await this.saveRepository.delete({ accountId });
    return {
      success: true,
      message: '云存档已删除',
    };
  }
}
