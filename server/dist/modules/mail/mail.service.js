"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const mongo_service_1 = require("../../shared/mongo/mongo.service");
let MailService = class MailService {
    constructor(mongoService) {
        this.mongoService = mongoService;
    }
    async listMails(accountId) {
        const collection = this.mongoService.playerMails();
        const mails = (await this.mongoService.findMany(collection, {
            accountId,
        }));
        return {
            success: true,
            mails: mails.map((mail) => this.serializeMail(mail)),
        };
    }
    async markRead(accountId, mailId) {
        const mail = await this.requireMail(accountId, mailId);
        if (!mail.readAt) {
            const now = this.mongoService.nowIso();
            await this.mongoService.updateById(this.mongoService.playerMails(), mail._id, {
                readAt: now,
                updatedAt: now,
            });
            mail.readAt = now;
            mail.updatedAt = now;
        }
        return {
            success: true,
            mail: this.serializeMail(mail),
        };
    }
    async claim(accountId, mailId) {
        const mail = await this.requireMail(accountId, mailId);
        if (mail.claimedAt) {
            return {
                success: false,
                message: '该邮件附件已领取',
                mail: this.serializeMail(mail),
                rewards: [],
            };
        }
        if (this.isExpired(mail.expireAt)) {
            return {
                success: false,
                message: '邮件已过期',
                mail: this.serializeMail(mail),
                rewards: [],
            };
        }
        const now = this.mongoService.nowIso();
        await this.mongoService.updateById(this.mongoService.playerMails(), mail._id, {
            claimedAt: now,
            readAt: mail.readAt || now,
            updatedAt: now,
        });
        mail.claimedAt = now;
        mail.readAt = mail.readAt || now;
        mail.updatedAt = now;
        return {
            success: true,
            message: '附件领取成功',
            mail: this.serializeMail(mail),
            rewards: this.normalizeAttachments(mail.attachments),
        };
    }
    async claimAll(accountId) {
        const collection = this.mongoService.playerMails();
        const mails = (await this.mongoService.findMany(collection, {
            accountId,
        }));
        const claimableMails = mails.filter((mail) => !mail.claimedAt && !this.isExpired(mail.expireAt));
        if (claimableMails.length === 0) {
            return {
                success: false,
                message: '当前没有可一键领取的邮件',
                claimedCount: 0,
                rewards: [],
                mails: mails.map((mail) => this.serializeMail(mail)),
            };
        }
        const rewardMap = new Map();
        const now = this.mongoService.nowIso();
        for (const mail of claimableMails) {
            await this.mongoService.updateById(collection, mail._id, {
                claimedAt: now,
                readAt: mail.readAt || now,
                updatedAt: now,
            });
            mail.claimedAt = now;
            mail.readAt = mail.readAt || now;
            mail.updatedAt = now;
            this.normalizeAttachments(mail.attachments).forEach((attachment) => {
                const key = `${attachment.type}:${attachment.id}`;
                const existing = rewardMap.get(key) || {
                    type: attachment.type,
                    id: attachment.id,
                    amount: 0,
                };
                existing.amount += Number(attachment.amount) || 0;
                rewardMap.set(key, existing);
            });
        }
        return {
            success: true,
            message: `已领取 ${claimableMails.length} 封邮件附件`,
            claimedCount: claimableMails.length,
            rewards: [...rewardMap.values()],
            mails: mails.map((mail) => this.serializeMail(mail)),
        };
    }
    async requireMail(accountId, mailId) {
        const collection = this.mongoService.playerMails();
        const mail = (await this.mongoService.getById(collection, mailId));
        if (!mail || mail.accountId !== accountId) {
            throw new common_1.NotFoundException('Mail not found');
        }
        return mail;
    }
    isExpired(expireAt) {
        if (!expireAt) {
            return false;
        }
        return Date.parse(String(expireAt)) <= Date.now();
    }
    normalizeAttachments(attachments) {
        return (Array.isArray(attachments) ? attachments : [])
            .map((entry) => ({
            type: (entry?.type === 'resource' ? 'resource' : 'item'),
            id: String(entry?.id || ''),
            amount: Math.max(0, Number(entry?.amount) || 0),
        }))
            .filter((entry) => entry.id && entry.amount > 0);
    }
    serializeMail(mail) {
        return {
            id: mail._id,
            title: mail.title || '未命名邮件',
            body: mail.body || '',
            sender: mail.sender || '系统',
            accountId: mail.accountId,
            createdAt: mail.createdAt,
            expireAt: mail.expireAt,
            readAt: mail.readAt || null,
            claimedAt: mail.claimedAt || null,
            attachments: this.normalizeAttachments(mail.attachments),
        };
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_service_1.MongoService])
], MailService);
//# sourceMappingURL=mail.service.js.map