/* ── Logistics API — aligned with backend schema ─────────────────── */

import client from "./client";
import type {
  LogisticsOrder,
  ResourceRequest,
  VehicleRequest,
  LogisticsOrderVehicle,
  LogisticsOrderItem,
  Stockpile,
} from "../types/models";
import type { Priority, OrderStatus } from "../types/enums";

/* ── Order CRUD ────────────────────────────────────────────────────── */

export interface CreateOrderPayload {
  group_id: string;
  name: string;
  destination_stockpile_id: string;
  operation_id?: string | null;
  source_stockpile_id?: string | null;
  priority?: Priority;
  deadline?: string | null;
  notes?: string | null;
}

export interface UpdateOrderPayload {
  name?: string;
  operation_id?: string | null;
  source_stockpile_id?: string | null;
  destination_stockpile_id?: string | null;
  priority?: Priority;
  status?: OrderStatus;
  deadline?: string | null;
  notes?: string | null;
}

export async function listOrders(groupId: string): Promise<LogisticsOrder[]> {
  const { data } = await client.get<LogisticsOrder[]>("/logistics", {
    params: { group_id: groupId },
  });
  return data;
}

export async function listOrdersByOperation(operationId: string): Promise<LogisticsOrder[]> {
  const { data } = await client.get<LogisticsOrder[]>("/logistics", {
    params: { operation_id: operationId },
  });
  return data;
}

export async function getOrder(orderId: string): Promise<LogisticsOrder> {
  const { data } = await client.get<LogisticsOrder>(`/logistics/${orderId}`);
  return data;
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<LogisticsOrder> {
  const { data } = await client.post<LogisticsOrder>("/logistics", payload);
  return data;
}

export async function updateOrder(
  orderId: string,
  payload: UpdateOrderPayload,
): Promise<LogisticsOrder> {
  const { data } = await client.patch<LogisticsOrder>(
    `/logistics/${orderId}`,
    payload,
  );
  return data;
}

export async function deleteOrder(orderId: string): Promise<void> {
  await client.delete(`/logistics/${orderId}`);
}

/* ── Resource requests within an order ─────────────────────────────── */

export interface CreateResourceRequestPayload {
  order_id: string;
  item_id: number;
  quantity_crates: number;
  priority?: Priority;
  notes?: string | null;
}

export interface UpdateResourceRequestPayload {
  item_id?: number;
  quantity_crates?: number;
  priority?: Priority;
  notes?: string | null;
}

export async function listResourceRequests(
  orderId: string,
): Promise<ResourceRequest[]> {
  const { data } = await client.get<ResourceRequest[]>(
    `/logistics/${orderId}/resource-requests`,
  );
  return data;
}

export async function createResourceRequest(
  orderId: string,
  payload: CreateResourceRequestPayload,
): Promise<ResourceRequest> {
  const { data } = await client.post<ResourceRequest>(
    `/logistics/${orderId}/resource-requests`,
    payload,
  );
  return data;
}

export async function updateResourceRequest(
  orderId: string,
  rrId: string,
  payload: UpdateResourceRequestPayload,
): Promise<ResourceRequest> {
  const { data } = await client.patch<ResourceRequest>(
    `/logistics/${orderId}/resource-requests/${rrId}`,
    payload,
  );
  return data;
}

export async function deleteResourceRequest(
  orderId: string,
  rrId: string,
): Promise<void> {
  await client.delete(`/logistics/${orderId}/resource-requests/${rrId}`);
}

/* ── Vehicle requests within an order ──────────────────────────────── */

export interface CreateVehicleRequestPayload {
  order_id: string;
  vehicle_type_id: number;
  quantity: number;
  priority?: Priority;
  notes?: string | null;
}

export interface UpdateVehicleRequestPayload {
  vehicle_type_id?: number;
  quantity?: number;
  priority?: Priority;
  notes?: string | null;
}

export async function listVehicleRequests(
  orderId: string,
): Promise<VehicleRequest[]> {
  const { data } = await client.get<VehicleRequest[]>(
    `/logistics/${orderId}/vehicle-requests`,
  );
  return data;
}

export async function createVehicleRequest(
  orderId: string,
  payload: CreateVehicleRequestPayload,
): Promise<VehicleRequest> {
  const { data } = await client.post<VehicleRequest>(
    `/logistics/${orderId}/vehicle-requests`,
    payload,
  );
  return data;
}

export async function updateVehicleRequest(
  orderId: string,
  vrId: string,
  payload: UpdateVehicleRequestPayload,
): Promise<VehicleRequest> {
  const { data } = await client.patch<VehicleRequest>(
    `/logistics/${orderId}/vehicle-requests/${vrId}`,
    payload,
  );
  return data;
}

export async function deleteVehicleRequest(
  orderId: string,
  vrId: string,
): Promise<void> {
  await client.delete(`/logistics/${orderId}/vehicle-requests/${vrId}`);
}

/* ── Order vehicles + item placements (slot-grid editor) ───────────── */

export interface AddOrderVehiclePayload {
  vehicle_type_id: number;
  display_name?: string | null;
}

export interface UpdateOrderVehiclePayload {
  display_name?: string;
  sort_order?: number;
  assigned_to?: string | null;
  completed?: boolean;
}

export async function listOrderVehicles(
  orderId: string,
): Promise<LogisticsOrderVehicle[]> {
  const { data } = await client.get<LogisticsOrderVehicle[]>(
    `/logistics/${orderId}/vehicles`,
  );
  return data;
}

export async function addOrderVehicle(
  orderId: string,
  payload: AddOrderVehiclePayload,
): Promise<LogisticsOrderVehicle> {
  const { data } = await client.post<LogisticsOrderVehicle>(
    `/logistics/${orderId}/vehicles`,
    payload,
  );
  return data;
}

export async function updateOrderVehicle(
  orderId: string,
  vehicleId: string,
  payload: UpdateOrderVehiclePayload,
): Promise<LogisticsOrderVehicle> {
  const { data } = await client.patch<LogisticsOrderVehicle>(
    `/logistics/${orderId}/vehicles/${vehicleId}`,
    payload,
  );
  return data;
}

export async function removeOrderVehicle(
  orderId: string,
  vehicleId: string,
): Promise<void> {
  await client.delete(`/logistics/${orderId}/vehicles/${vehicleId}`);
}

export interface AddOrderItemPayload {
  item_id: number;
  vehicle_id?: string | null;
  slot_index?: number | null;
}

export interface MoveOrderItemPayload {
  vehicle_id?: string | null;
  slot_index?: number | null;
  assigned_to?: string | null;
  completed?: boolean;
}

export async function listOrderItems(
  orderId: string,
): Promise<LogisticsOrderItem[]> {
  const { data } = await client.get<LogisticsOrderItem[]>(
    `/logistics/${orderId}/items`,
  );
  return data;
}

export async function addOrderItem(
  orderId: string,
  payload: AddOrderItemPayload,
): Promise<LogisticsOrderItem> {
  const { data } = await client.post<LogisticsOrderItem>(
    `/logistics/${orderId}/items`,
    payload,
  );
  return data;
}

export async function moveOrderItem(
  orderId: string,
  itemId: string,
  payload: MoveOrderItemPayload,
): Promise<LogisticsOrderItem> {
  const { data } = await client.patch<LogisticsOrderItem>(
    `/logistics/${orderId}/items/${itemId}`,
    payload,
  );
  return data;
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<void> {
  await client.delete(`/logistics/${orderId}/items/${itemId}`);
}

/* ── Stockpiles ────────────────────────────────────────────────────── */

export interface CreateStockpilePayload {
  group_id: string;
  war_id: number;
  region_id: number;
  structure_type: string;
  code_6digit: string;
  name: string;
  type?: string;
  notes?: string | null;
  map_hex?: string | null;
  map_x?: number | null;
  map_y?: number | null;
}

export async function listStockpiles(
  groupId: string,
  warId: number,
): Promise<Stockpile[]> {
  const { data } = await client.get<Stockpile[]>("/stockpiles", {
    params: { group_id: groupId, war_id: warId },
  });
  return data;
}

export async function createStockpile(
  payload: CreateStockpilePayload,
): Promise<Stockpile> {
  const { data } = await client.post<Stockpile>("/stockpiles", payload);
  return data;
}

export async function deleteStockpile(stockpileId: string): Promise<void> {
  await client.delete(`/stockpiles/${stockpileId}`);
}
