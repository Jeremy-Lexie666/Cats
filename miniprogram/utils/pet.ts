import type { PetProfile, PetRecord, VaccineRecord, DewormRecord, WeightRecord } from "../types/domain";

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export function formatShortDate(dateLike: string): string {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function formatPetAge(birthday: string, now = new Date()): string {
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime()) || birth > now) {
    return "年龄待补充";
  }

  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  const months = totalMonths - (now.getDate() < birth.getDate() ? 1 : 0);

  if (months < 12) {
    return `${Math.max(months, 0)}个月`;
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths > 0 ? `${years}岁${restMonths}个月` : `${years}岁`;
}

export function getDaysLeft(dateLike?: string, now = new Date()): number {
  if (!dateLike) {
    return Number.POSITIVE_INFINITY;
  }
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.ceil((end - start) / 86400000);
}

export function getLatestWeight(records: PetRecord[]): WeightRecord | undefined {
  return records
    .filter((item): item is WeightRecord => item.type === "weight")
    .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
}

export function getLatestRecord(records: PetRecord[]): PetRecord | undefined {
  return [...records].sort((a, b) => getRecordDate(b).localeCompare(getRecordDate(a)))[0];
}

export function getUpcomingReminder(pet: PetProfile, records: PetRecord[]) {
  const remindable = records
    .filter((item): item is VaccineRecord | DewormRecord => item.type === "vaccine" || item.type === "deworm")
    .map((item) => {
      const dueDate = item.nextDueAt;
      const title =
        item.type === "vaccine"
          ? `${pet.name} 的${item.vaccineName}提醒`
          : `${pet.name} 的${item.mode === "internal" ? "体内" : "体外"}驱虫提醒`;

      return {
        id: item.id,
        petId: pet.id,
        title,
        dueDate: dueDate || "",
        daysLeft: getDaysLeft(dueDate)
      };
    })
    .filter((item) => Number.isFinite(item.daysLeft))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return remindable[0];
}

export function getRecordDate(record: PetRecord): string {
  if (record.type === "vaccine") return record.vaccinatedAt;
  if (record.type === "deworm") return record.executedAt;
  return record.recordedAt;
}

export function getRecordTitle(record: PetRecord): string {
  if (record.type === "vaccine") return `疫苗 · ${record.vaccineName}`;
  if (record.type === "deworm") return `驱虫 · ${record.mode === "internal" ? "体内" : "体外"}`;
  return `体重 · ${record.weightKg} kg`;
}

export function getRecordSummary(record: PetRecord): string {
  if (record.type === "vaccine") {
    return record.nextDueAt ? `下次提醒 ${formatShortDate(record.nextDueAt)}` : "未设置下次提醒";
  }
  if (record.type === "deworm") {
    return record.brand || "驱虫品牌待补充";
  }
  return record.note || "记录了新的体重变化";
}
