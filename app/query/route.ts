import { Pool } from "pg";

const db = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

const client = await db.connect();

async function listInvoices() {
    const result = await client.query(
        `
        SELECT invoices.amount, customers.name
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE invoices.amount = $1;
    `,
        [666]
    ); // 파라미터를 사용하여 SQL 인젝션 방지

    return result.rows;
}

export async function GET() {
    return Response.json({
        message:
            "Uncomment this file and remove this line. You can delete this file when you are finished.",
    });
    try {
        return Response.json(await listInvoices());
    } catch (error) {
        return Response.json({ error }, { status: 500 });
    }
}
