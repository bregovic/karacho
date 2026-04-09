'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function logAdminAction(action: string, description?: string, targetType?: string, targetId?: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') return;

  await db.adminAction.create({
    data: {
      adminId: session.user.id,
      action,
      description,
      targetType,
      targetId
    }
  });
}

export async function getAdminAuditLog() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  return await db.adminAction.findMany({
    include: { admin: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function updateTechnicalConfig(key: string, value: string, category: string = 'GENERAL') {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  await db.technicalConfig.upsert({
    where: { key },
    update: { value, category },
    create: { key, value, category }
  });

  revalidatePath('/admin/tech');
  return { success: true };
}

export async function getTechnicalConfig(category?: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Nemáte oprávnění');

  return await db.technicalConfig.findMany({
    where: category ? { category } : undefined,
    orderBy: { key: 'asc' }
  });
}

export async function checkAdminPassword(password: string) {
  // Specifické heslo pro sekci Technical Parameters podle zadání
  return password === 'Admin123';
}
