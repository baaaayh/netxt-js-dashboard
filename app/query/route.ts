import { Pool } from "pg";

const db = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

async function listInvoices() {
    const client = await db.connect();
    try {
        const result = await client.query(
            `
            SELECT invoices.amount, customers.name
            FROM invoices
            JOIN customers ON invoices.customer_id = customers.id
            WHERE invoices.amount = $1;
            `,
            [666]
        );

        return result.rows;
    } finally {
        client.release();
    }
}

export async function GET() {
    try {
        const invoices = await listInvoices();
        return Response.json({ invoices });
    } catch (error) {
        return Response.json(
            { error: error || "An error occurred" },
            { status: 500 }
        );
    }
}
