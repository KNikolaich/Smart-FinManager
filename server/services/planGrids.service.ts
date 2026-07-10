import { prisma } from "../prisma";

export function listPlanGrids(userId: string) {
  return prisma.planGrid.findMany({ where: { userId } });
}

export async function getPlanGrid(userId: string, type: string) {
  // Try to find the specific type
  let planGrid = await prisma.planGrid.findFirst({
    where: { userId, type }
  });

  // Backward compatibility: if not found, check for old "all-in-one" format
  if (!planGrid) {
    const oldPlanGrid = await prisma.planGrid.findFirst({
      where: { userId, type: 'all' } // Assuming old format used 'all' or similar
    });

    if (oldPlanGrid) {
      // Found old format, distribute data
      const oldData = oldPlanGrid.data as any;

      // Distribute to new format
      const types = ['config', 'cashbacks', 'comments', 'budget', 'goals'];
      for (const t of types) {
        if (oldData[t]) {
          await prisma.planGrid.upsert({
            where: { userId_type: { userId, type: t } },
            update: { data: oldData[t] },
            create: { userId, type: t, data: oldData[t] }
          });
        }
      }

      // Delete old format
      await prisma.planGrid.delete({ where: { id: oldPlanGrid.id } });

      // Return requested type
      planGrid = await prisma.planGrid.findFirst({
        where: { userId, type }
      });
    }
  }

  return planGrid ? planGrid.data : null;
}

export async function setPlanGrid(userId: string, type: string, data: any) {
  const planGrid = await prisma.planGrid.upsert({
    where: { userId_type: { userId, type } },
    update: { data },
    create: { userId, type, data }
  });
  return planGrid.data;
}

export async function setPlanGridBulk(userId: string, data: any) {
  // Split the bulk data into parts for compatibility with individual type storage
  const parts = [
    { type: 'config', data: data.config },
    { type: 'cashback', data: data.cashback },
    { type: 'comment', data: data.comment ? { comment: data.comment } : null },
    { type: 'now', data: (data.subjects || data.rows) ? { subjects: data.subjects, rows: data.rows, pastRows: data.pastRows } : null }
  ];

  for (const part of parts) {
    if (part.data) {
      await prisma.planGrid.upsert({
        where: { userId_type: { userId, type: part.type } },
        update: { data: part.data as any },
        create: { userId, type: part.type, data: part.data as any }
      });
    }
  }
}
