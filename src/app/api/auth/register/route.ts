import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Vyplňte všechna pole." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Heslo musí mít alespoň 6 znaků." }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Tento email je již zaregistrován." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Kontrola, zda je email v whitelistu administrátorů
    const isAdmin = await db.adminEmail.findUnique({ where: { email } });

    await db.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword,
        role: isAdmin ? 'ADMIN' : 'USER'
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
  }
}
