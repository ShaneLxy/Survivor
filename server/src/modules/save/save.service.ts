import { Injectable } from '@nestjs/common';
import { CloudbaseService } from '../../shared/cloudbase/cloudbase.service';
import {
  PlayerSaveDocument,
  UserAccountDocument,
} from '../../shared/cloudbase/cloudbase.types';
import { UpsertSaveDto } from './dto/upsert-save.dto';

@Injectable()
export class SaveService {
  constructor(private readonly cloudbaseService: CloudbaseService) {}

  async getSaveByAccountId(accountId: string) {
    const collection = this.cloudbaseService.playerSaves();
    const save = (await this.cloudbaseService.findOne(collection, {
      accountId,
    })) as PlayerSaveDocument | null;

    if (!save?.saveData) {
      return {
        success: true,
        message: 'No cloud save found',
        saveData: null,
      };
    }

    return {
      success: true,
      message: 'Cloud save loaded',
      saveData: {
        version: save.version,
        timestamp: save.lastSaveTime,
        data: save.saveData,
      },
    };
  }

  async upsertSave(user: { id: string } | UserAccountDocument, dto: UpsertSaveDto) {
    const wrapper = dto.saveData || {};
    const data = wrapper.data || {};
    const lastSaveTime = Number(data.lastSaveTime || wrapper.timestamp || Date.now());
    const accountId = 'id' in user ? user.id : user._id;
    const collection = this.cloudbaseService.playerSaves();
    const existing = (await this.cloudbaseService.findOne(collection, {
      accountId,
    })) as PlayerSaveDocument | null;
    const now = this.cloudbaseService.nowIso();

    if (existing?._id && Number(existing.lastSaveTime || 0) > lastSaveTime) {
      return {
        success: true,
        message: 'Cloud save kept because remote data is newer',
        saveData: {
          version: existing.version,
          timestamp: existing.lastSaveTime,
          data: existing.saveData,
        },
      };
    }

    if (existing?._id) {
      await this.cloudbaseService.updateById(collection, existing._id, {
        version: wrapper.version || '2.0.0',
        lastSaveTime,
        saveData: data,
        updatedAt: now,
      });
    } else {
      await this.cloudbaseService.insert(collection, {
        accountId,
        version: wrapper.version || '2.0.0',
        lastSaveTime,
        saveData: data,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      message: 'Cloud save updated',
      saveData: {
        version: wrapper.version || '2.0.0',
        timestamp: lastSaveTime,
        data,
      },
    };
  }

  async deleteSave(accountId: string) {
    const collection = this.cloudbaseService.playerSaves();
    await this.cloudbaseService.removeWhere(collection, { accountId });
    return {
      success: true,
      message: 'Cloud save deleted',
    };
  }
}
