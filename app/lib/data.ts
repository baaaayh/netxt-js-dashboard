import { Pool } from "pg";
import {
    CustomerField,
    CustomersTableType,
    InvoiceForm,
    InvoicesTable,
    Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

if (
    !process.env.POSTGRES_USER ||
    !process.env.POSTGRES_PASSWORD ||
    !process.env.POSTGRES_DATABASE ||
    !process.env.POSTGRES_HOST
) {
    throw new Error(
        "Missing required environment variables for database configuration."
    );
}

const db = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

type FetchFilteredInvoicesResult = {
    id: string;
    amount: number;
    date: string;
    status: string;
    name: string;
    email: string;
    image_url: string;
};

export async function fetchRevenue(): Promise<Revenue[]> {
    const client = await db.connect();
    try {
        console.log("Fetching revenue data...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const data = await client.query("SELECT * FROM revenue");

        console.log("Data fetch completed after 3 seconds.");

        return data.rows;
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch revenue data.");
    } finally {
        client.release();
    }
}

export async function fetchLatestInvoices(): Promise<InvoicesTable[]> {
    const client = await db.connect();
    try {
        const data = await client.query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5
    `);

        return data.rows.map((invoice) => ({
            ...invoice,
            amount: formatCurrency(invoice.amount),
        }));
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch the latest invoices.");
    } finally {
        client.release();
    }
}

export async function fetchCardData(): Promise<{
    numberOfInvoices: number;
    numberOfCustomers: number;
    totalPaidInvoices: string;
    totalPendingInvoices: string;
}> {
    const client = await db.connect();
    try {
        const invoiceCountPromise = client.query(
            "SELECT COUNT(*) FROM invoices"
        );
        const customerCountPromise = client.query(
            "SELECT COUNT(*) FROM customers"
        );
        const invoiceStatusPromise = client.query(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
      FROM invoices
    `);

        const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
            invoiceCountPromise,
            customerCountPromise,
            invoiceStatusPromise,
        ]);

        return {
            numberOfInvoices: Number(invoiceCount.rows[0].count ?? "0"),
            numberOfCustomers: Number(customerCount.rows[0].count ?? "0"),
            totalPaidInvoices: formatCurrency(
                invoiceStatus.rows[0].paid ?? "0"
            ),
            totalPendingInvoices: formatCurrency(
                invoiceStatus.rows[0].pending ?? "0"
            ),
        };
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch card data.");
    } finally {
        client.release();
    }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
    query: string,
    currentPage: number
): Promise<FetchFilteredInvoicesResult[]> {
    const client = await db.connect();
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const data = await client.query(
            `
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      ORDER BY invoices.date DESC
      LIMIT $2 OFFSET $3
    `,
            [`%${query}%`, ITEMS_PER_PAGE, offset]
        );

        return data.rows;
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch invoices.");
    } finally {
        client.release();
    }
}

export async function fetchInvoicesPages(query: string): Promise<number> {
    const client = await db.connect();
    try {
        const data = await client.query(
            `
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
    `,
            [`%${query}%`]
        );

        return Math.ceil(Number(data.rows[0].count) / ITEMS_PER_PAGE);
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch total number of invoices.");
    } finally {
        client.release();
    }
}

export async function fetchInvoiceById(id: string): Promise<InvoiceForm> {
    const client = await db.connect();
    try {
        const data = await client.query(
            `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1
    `,
            [id]
        );

        if (data.rows.length === 0) throw new Error("Invoice not found.");

        return {
            ...data.rows[0],
            amount: data.rows[0].amount / 100, // Convert amount from cents to dollars
        };
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch invoice.");
    } finally {
        client.release();
    }
}

export async function fetchCustomers(): Promise<CustomerField[]> {
    const client = await db.connect();
    try {
        const data = await client.query(
            `
      SELECT id, name
      FROM customers
      ORDER BY name ASC
    `
        );
        return data.rows;
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch all customers.");
    } finally {
        client.release();
    }
}

export async function fetchFilteredCustomers(
    query: string
): Promise<CustomersTableType[]> {
    const client = await db.connect();
    try {
        const data = await client.query(
            `
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `,
            [`%${query}%`]
        );

        return data.rows.map((customer) => ({
            ...customer,
            total_pending: formatCurrency(customer.total_pending),
            total_paid: formatCurrency(customer.total_paid),
        }));
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch customer table.");
    } finally {
        client.release();
    }
}
