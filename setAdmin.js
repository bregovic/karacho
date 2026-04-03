const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.user.update({where: {email: 'vac.kral@gmail.com'}, data: {role: 'ADMIN'}}).then((r) => { console.log(r); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
