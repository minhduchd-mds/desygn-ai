/**
 * base.ts — BaseRepository
 *
 * Holds the Supabase client reference and provides generic CRUD helpers
 * that all domain repositories extend.
 */

import { supabase } from "../supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export abstract class BaseRepository {
  /** Returns the active Supabase client or throws if env vars are missing. */
  protected getClient(): SupabaseClient {
    if (!supabase) throw new Error("Supabase not configured");
    return supabase;
  }

  /** Fetch a single row by primary-key id. */
  protected async findById<T>(table: string, id: string): Promise<T> {
    const { data, error } = await this.getClient()
      .from(table)
      .select("*")
      .eq("id", id)
      .single<T>();
    if (error) throw error;
    return data;
  }

  /** Fetch multiple rows filtered by a column value. */
  protected async findMany<T>(
    table: string,
    column: string,
    value: string,
    orderBy = "created_at",
    ascending = false,
  ): Promise<T[]> {
    const { data, error } = await this.getClient()
      .from(table)
      .select("*")
      .eq(column, value)
      .order(orderBy, { ascending })
      .returns<T[]>();
    if (error) throw error;
    return data ?? [];
  }

  /** Insert a single row and return the inserted record. */
  protected async create<T>(table: string, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.getClient()
      .from(table)
      .insert(payload)
      .select()
      .single<T>();
    if (error) throw error;
    return data;
  }

  /** Batch-insert rows and return all inserted records. */
  protected async createMany<T>(table: string, payloads: Record<string, unknown>[]): Promise<T[]> {
    const { data, error } = await this.getClient()
      .from(table)
      .insert(payloads)
      .select()
      .returns<T[]>();
    if (error) throw error;
    return data ?? [];
  }

  /** Update a row by id and return the updated record. */
  protected async update<T>(
    table: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.getClient()
      .from(table)
      .update(payload)
      .eq("id", id)
      .select()
      .single<T>();
    if (error) throw error;
    return data;
  }

  /** Delete a row by id. */
  protected async delete(table: string, id: string): Promise<void> {
    const { error } = await this.getClient()
      .from(table)
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
