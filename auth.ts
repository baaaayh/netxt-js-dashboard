import { Pool } from "pg";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";
import type { User } from "@/app/lib/definitions";
import bcrypt from "bcrypt";

const db = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

async function getUser(email: string): Promise<User | undefined> {
    const client = await db.connect();
    try {
        // 파라미터화된 쿼리를 사용하여 SQL 인젝션 방지
        const result = await client.query(
            `SELECT * FROM users WHERE email = $1`,
            [email] // 이메일 값을 파라미터로 전달
        );

        // 사용자가 존재하지 않을 경우 undefined 반환
        return result.rows[0];
    } catch (error) {
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    } finally {
        // 항상 연결 해제
        client.release();
    }
}

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({
                        email: z.string().email(),
                        password: z.string().min(6),
                    })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;
                    const passwordsMatch = await bcrypt.compare(
                        password,
                        user.password
                    );

                    if (passwordsMatch) return user;
                }
                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
});
