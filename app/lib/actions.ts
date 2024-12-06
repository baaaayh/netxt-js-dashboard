"use server";

import { z } from "zod";
import { Pool } from "pg";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(["pending", "paid"]),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const db = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

export async function createInvoice(formData: FormData) {
    const rawFormData = Object.fromEntries(formData.entries());
    const { customerId, amount, status } = CreateInvoice.parse(rawFormData);

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    console.log(customerId, amount, status);
    const client = await db.connect();
    try {
        await client.query(
            `INSERT INTO invoices (customer_id, amount, status, date) VALUES ($1, $2, $3, $4)`,
            [customerId, amountInCents, status, date]
        );
    } catch (err) {
        console.error("Error inserting invoice:", err);
        throw err;
    } finally {
        client.release();
    }

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const rawFormData = Object.fromEntries(formData.entries());
    const { customerId, amount, status } = UpdateInvoice.parse(rawFormData);

    const amountInCents = amount * 100;

    const client = await db.connect();
    try {
        await client.query(
            `UPDATE invoices SET customer_id = $1, amount = $2, status = $3 WHERE id = $4`,
            [customerId, amountInCents, status, id]
        );
    } catch (err) {
        console.error("Error inserting invoice:", err);
        throw err;
    } finally {
        client.release();
    }

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
    const client = await db.connect();
    try {
        await client.query("DELETE FROM invoices WHERE id = $1", [id]);
    } catch (error) {
        console.log(error);
    } finally {
        client.release();
    }

    revalidatePath("/dashboard/invoices");
}
