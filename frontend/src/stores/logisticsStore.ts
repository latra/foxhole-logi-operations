/* ── Logistics Store (Zustand) — order-based model ───────────────── */

import { create } from "zustand";
import type {
  LogisticsOrder,
  ResourceRequest,
  VehicleRequest,
  LogisticsOrderVehicle,
  LogisticsOrderItem,
  Stockpile,
  VehicleDefinition,
  FoxholeItem,
  CatalogItem,
  CatalogVehicleType,
} from "../types/models";
import type { OrderStatus, Priority } from "../types/enums";
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  listResourceRequests,
  createResourceRequest,
  updateResourceRequest,
  deleteResourceRequest,
  listVehicleRequests,
  createVehicleRequest,
  updateVehicleRequest,
  deleteVehicleRequest,
  listOrderVehicles,
  addOrderVehicle,
  updateOrderVehicle,
  removeOrderVehicle,
  listOrderItems,
  addOrderItem,
  moveOrderItem,
  removeOrderItem,
  listStockpiles,
  createStockpile,
  deleteStockpile,
  type CreateStockpilePayload,
} from "../api/logistics";
import {
  getVehicleDefinitions,
  toFoxholeItem,
  listBackendItems,
  createBackendItem,
  listBackendVehicleTypes,
  createBackendVehicleType,
} from "../api/catalog";
import { toastError } from "../components/common/Toast";

const FACTION_CODE_TO_ENUM: Record<string, string> = {
  W: "WARDEN",
  C: "COLONIAL",
  N: "NEUTRAL",
};

const VEHICLE_CATEGORY_TO_FACILITY: Record<string, string> = {
  truck: "GARAGE",
  ship: "SHIPYARD",
  train: "FACTORY",
  crane: "FACTORY",
  other: "FACTORY",
};

interface LogisticsState {
  /* ── Data ────────────────────────────────────────────────────────── */
  orders: LogisticsOrder[];
  activeOrderId: string | null;
  resourceRequests: ResourceRequest[];
  vehicleRequests: VehicleRequest[];
  /** Vehicles placed into the active order's slot-grid editor. */
  orderVehicles: LogisticsOrderVehicle[];
  /** Item placements for the active order — vehicle_id null = unassigned area. */
  orderItems: LogisticsOrderItem[];
  stockpiles: Stockpile[];
  vehicleDefinitions: VehicleDefinition[];
  itemCatalog: FoxholeItem[];
  backendItems: CatalogItem[];
  backendVehicleTypes: CatalogVehicleType[];
  catalogFilter: string;
  loading: boolean;
  catalogLoading: boolean;

  /* ── Actions ────────────────────────────────────────────────────── */
  fetchOrders: (groupId: string) => Promise<void>;
  selectOrder: (orderId: string) => Promise<void>;
  /** Lightweight re-fetches for live WebSocket updates — unlike selectOrder,
   *  these don't clear state first, so the grid doesn't flash empty. */
  refetchOrder: (orderId: string) => Promise<void>;
  refetchOrderItems: (orderId: string) => Promise<void>;
  refetchOrderVehicles: (orderId: string) => Promise<void>;
  createNewOrder: (
    groupId: string,
    name: string,
    destinationStockpileId: string,
  ) => Promise<LogisticsOrder | null>;
  updateActiveOrder: (data: {
    name?: string;
    destination_stockpile_id?: string;
    source_stockpile_id?: string | null;
    priority?: Priority;
    status?: OrderStatus;
    deadline?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  deleteActiveOrder: (orderId: string) => Promise<void>;

  /* Resource requests */
  addResourceRequest: (
    itemId: number,
    quantityCrates: number,
    priority?: Priority,
    notes?: string | null,
  ) => Promise<void>;
  updateResourceReq: (
    rrId: string,
    data: { quantity_crates?: number; priority?: Priority; notes?: string | null },
  ) => Promise<void>;
  removeResourceRequest: (rrId: string) => Promise<void>;

  /* Vehicle requests */
  addVehicleRequest: (
    vehicleTypeId: number,
    quantity: number,
    priority?: Priority,
    notes?: string | null,
  ) => Promise<void>;
  updateVehicleReq: (
    vrId: string,
    data: { quantity?: number; priority?: Priority; notes?: string | null },
  ) => Promise<void>;
  removeVehicleRequest: (vrId: string) => Promise<void>;

  /* Slot-grid editor: vehicles + item placements */
  addSlotVehicle: (vehicleTypeId: number, displayName?: string | null) => Promise<void>;
  removeSlotVehicle: (vehicleId: string) => Promise<void>;
  assignSlotVehicle: (vehicleId: string, userId: string) => Promise<void>;
  unassignSlotVehicle: (vehicleId: string) => Promise<void>;
  completeSlotVehicle: (vehicleId: string, userId: string) => Promise<void>;
  uncompleteSlotVehicle: (vehicleId: string) => Promise<void>;
  addSlotItem: (
    itemId: number,
    vehicleId: string | null,
    slotIndex?: number,
  ) => Promise<void>;
  moveSlotItem: (
    itemId: string,
    vehicleId: string | null,
    slotIndex: number,
  ) => Promise<void>;
  removeSlotItem: (itemId: string) => Promise<void>;
  assignSlotItem: (itemId: string, userId: string) => Promise<void>;
  unassignSlotItem: (itemId: string) => Promise<void>;
  completeSlotItem: (itemId: string, userId: string) => Promise<void>;
  uncompleteSlotItem: (itemId: string) => Promise<void>;

  /* Catalog & stockpiles */
  fetchStockpiles: (groupId: string, warId: number) => Promise<void>;
  createNewStockpile: (
    payload: CreateStockpilePayload,
  ) => Promise<Stockpile | null>;
  removeStockpile: (stockpileId: string) => Promise<boolean>;
  fetchCatalogData: () => Promise<void>;
  setCatalogFilter: (category: string) => void;
  /** Look up (or lazily register) the backend catalog row for an external
   *  Foxhole item, so it can be used as a resource request's item_id FK. */
  resolveItemId: (item: FoxholeItem) => Promise<number | null>;
  /** Same idea for vehicle definitions → vehicle_type_id FK. */
  resolveVehicleTypeId: (def: VehicleDefinition) => Promise<number | null>;
  reset: () => void;
}

export const useLogisticsStore = create<LogisticsState>((set, get) => {
  /** The backend groups/compacts each container (a vehicle, or the
   *  unassigned area) and returns items pre-sorted — so after any mutation
   *  that can affect a container's contents, just re-fetch the full list
   *  instead of recomputing an order client-side. */
  const refreshOrderItems = async (activeOrderId: string) => {
    const items = await listOrderItems(activeOrderId);
    set({ orderItems: items });
  };

  return {
  orders: [],
  activeOrderId: null,
  resourceRequests: [],
  vehicleRequests: [],
  orderVehicles: [],
  orderItems: [],
  stockpiles: [],
  vehicleDefinitions: [],
  itemCatalog: [],
  backendItems: [],
  backendVehicleTypes: [],
  catalogFilter: "All",
  loading: false,
  catalogLoading: false,

  /* ── Order CRUD ──────────────────────────────────────────────────── */

  fetchOrders: async (groupId) => {
    set({ loading: true });
    try {
      const orders = await listOrders(groupId);
      set({ orders, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectOrder: async (orderId) => {
    set({
      activeOrderId: orderId,
      resourceRequests: [],
      vehicleRequests: [],
      orderVehicles: [],
      orderItems: [],
    });
    try {
      const [order, rrs, vrs, ovs, ois] = await Promise.all([
        getOrder(orderId),
        listResourceRequests(orderId),
        listVehicleRequests(orderId),
        listOrderVehicles(orderId),
        listOrderItems(orderId),
      ]);
      const knownOrders = get().orders;
      set({
        resourceRequests: rrs,
        vehicleRequests: vrs,
        orderVehicles: ovs,
        orderItems: ois,
        // A deep link (e.g. from an Operation's linked lists) may point at an
        // order that isn't in the currently-loaded list — add it rather than
        // silently dropping it, so the editor still has something to render.
        orders: knownOrders.some((o) => o.id === orderId)
          ? knownOrders.map((o) => (o.id === orderId ? order : o))
          : [...knownOrders, order],
      });
    } catch {
      toastError("Failed to load order details");
    }
  },

  refetchOrder: async (orderId) => {
    // Ignore late responses for an order the user has since navigated away from
    if (get().activeOrderId !== orderId) return;
    try {
      const order = await getOrder(orderId);
      if (get().activeOrderId !== orderId) return;
      set({ orders: get().orders.map((o) => (o.id === orderId ? order : o)) });
    } catch {
      // A live-update refetch failing silently is fine — the next one will retry
    }
  },

  refetchOrderItems: async (orderId) => {
    if (get().activeOrderId !== orderId) return;
    try {
      const items = await listOrderItems(orderId);
      if (get().activeOrderId !== orderId) return;
      set({ orderItems: items });
    } catch {
      // ignore — next event will retry
    }
  },

  refetchOrderVehicles: async (orderId) => {
    if (get().activeOrderId !== orderId) return;
    try {
      const vehicles = await listOrderVehicles(orderId);
      if (get().activeOrderId !== orderId) return;
      set({ orderVehicles: vehicles });
    } catch {
      // ignore — next event will retry
    }
  },

  createNewOrder: async (groupId, name, destinationStockpileId) => {
    try {
      const newOrder = await createOrder({
        group_id: groupId,
        name,
        destination_stockpile_id: destinationStockpileId,
      });
      set({ orders: [...get().orders, newOrder] });
      return newOrder;
    } catch {
      toastError("Failed to create order");
      return null;
    }
  },

  updateActiveOrder: async (data) => {
    const { activeOrderId, orders } = get();
    if (!activeOrderId) return;

    const prev = orders;
    set({
      orders: prev.map((o) =>
        o.id === activeOrderId ? { ...o, ...data } : o,
      ),
    });
    try {
      await updateOrder(activeOrderId, data);
    } catch {
      set({ orders: prev });
      toastError("Failed to update order");
    }
  },

  deleteActiveOrder: async (orderId) => {
    const prev = get().orders;
    const wasActive = get().activeOrderId === orderId;
    set({
      orders: prev.filter((o) => o.id !== orderId),
      activeOrderId: wasActive ? null : get().activeOrderId,
      resourceRequests: wasActive ? [] : get().resourceRequests,
      vehicleRequests: wasActive ? [] : get().vehicleRequests,
      orderVehicles: wasActive ? [] : get().orderVehicles,
      orderItems: wasActive ? [] : get().orderItems,
    });
    try {
      await deleteOrder(orderId);
    } catch {
      set({ orders: prev });
      toastError("Failed to delete order");
    }
  },

  /* ── Resource requests ───────────────────────────────────────────── */

  addResourceRequest: async (itemId, quantityCrates, priority, notes) => {
    const { activeOrderId } = get();
    if (!activeOrderId) return;

    try {
      const rr = await createResourceRequest(activeOrderId, {
        order_id: activeOrderId,
        item_id: itemId,
        quantity_crates: quantityCrates,
        priority,
        notes,
      });
      set({ resourceRequests: [...get().resourceRequests, rr] });
    } catch {
      toastError("Failed to add resource request");
    }
  },

  updateResourceReq: async (rrId, data) => {
    const { activeOrderId, resourceRequests } = get();
    if (!activeOrderId) return;

    const prev = resourceRequests;
    set({
      resourceRequests: prev.map((r) =>
        r.id === rrId ? { ...r, ...data } : r,
      ),
    });
    try {
      await updateResourceRequest(activeOrderId, rrId, data);
    } catch {
      set({ resourceRequests: prev });
      toastError("Failed to update resource request");
    }
  },

  removeResourceRequest: async (rrId) => {
    const { activeOrderId, resourceRequests } = get();
    if (!activeOrderId) return;

    const prev = resourceRequests;
    set({ resourceRequests: prev.filter((r) => r.id !== rrId) });
    try {
      await deleteResourceRequest(activeOrderId, rrId);
    } catch {
      set({ resourceRequests: prev });
      toastError("Failed to remove resource request");
    }
  },

  /* ── Vehicle requests ────────────────────────────────────────────── */

  addVehicleRequest: async (vehicleTypeId, quantity, priority, notes) => {
    const { activeOrderId } = get();
    if (!activeOrderId) return;

    try {
      const vr = await createVehicleRequest(activeOrderId, {
        order_id: activeOrderId,
        vehicle_type_id: vehicleTypeId,
        quantity,
        priority,
        notes,
      });
      set({ vehicleRequests: [...get().vehicleRequests, vr] });
    } catch {
      toastError("Failed to add vehicle request");
    }
  },

  updateVehicleReq: async (vrId, data) => {
    const { activeOrderId, vehicleRequests } = get();
    if (!activeOrderId) return;

    const prev = vehicleRequests;
    set({
      vehicleRequests: prev.map((v) =>
        v.id === vrId ? { ...v, ...data } : v,
      ),
    });
    try {
      await updateVehicleRequest(activeOrderId, vrId, data);
    } catch {
      set({ vehicleRequests: prev });
      toastError("Failed to update vehicle request");
    }
  },

  removeVehicleRequest: async (vrId) => {
    const { activeOrderId, vehicleRequests } = get();
    if (!activeOrderId) return;

    const prev = vehicleRequests;
    set({ vehicleRequests: prev.filter((v) => v.id !== vrId) });
    try {
      await deleteVehicleRequest(activeOrderId, vrId);
    } catch {
      set({ vehicleRequests: prev });
      toastError("Failed to remove vehicle request");
    }
  },

  /* ── Slot-grid editor: vehicles + item placements ─────────────────── */

  addSlotVehicle: async (vehicleTypeId, displayName) => {
    const { activeOrderId } = get();
    if (!activeOrderId) return;

    try {
      const ov = await addOrderVehicle(activeOrderId, {
        vehicle_type_id: vehicleTypeId,
        display_name: displayName,
      });
      set({ orderVehicles: [...get().orderVehicles, ov] });
    } catch {
      toastError("Failed to add vehicle");
    }
  },

  removeSlotVehicle: async (vehicleId) => {
    const { activeOrderId, orderVehicles, orderItems } = get();
    if (!activeOrderId) return;

    const prevVehicles = orderVehicles;
    const prevItems = orderItems;
    // Optimistically drop the vehicle and unassign its items locally
    set({
      orderVehicles: prevVehicles.filter((v) => v.id !== vehicleId),
      orderItems: prevItems.map((i) =>
        i.vehicle_id === vehicleId ? { ...i, vehicle_id: null } : i,
      ),
    });
    try {
      await removeOrderVehicle(activeOrderId, vehicleId);
      // Re-sync items — the backend re-slots and compacts the unassigned area
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderVehicles: prevVehicles, orderItems: prevItems });
      toastError("Failed to remove vehicle");
    }
  },

  assignSlotVehicle: async (vehicleId, userId) => {
    const { activeOrderId, orderVehicles } = get();
    if (!activeOrderId) return;

    const prev = orderVehicles;
    set({
      orderVehicles: prev.map((v) =>
        v.id === vehicleId ? { ...v, assigned_to: userId } : v,
      ),
    });
    try {
      await updateOrderVehicle(activeOrderId, vehicleId, { assigned_to: userId });
    } catch {
      set({ orderVehicles: prev });
      toastError("Failed to assign vehicle");
    }
  },

  completeSlotVehicle: async (vehicleId, userId) => {
    const { activeOrderId, orderVehicles } = get();
    if (!activeOrderId) return;

    const prev = orderVehicles;
    set({
      orderVehicles: prev.map((v) =>
        v.id === vehicleId ? { ...v, assigned_to: userId, completed: true } : v,
      ),
    });
    try {
      await updateOrderVehicle(activeOrderId, vehicleId, {
        assigned_to: userId,
        completed: true,
      });
    } catch {
      set({ orderVehicles: prev });
      toastError("Failed to complete vehicle");
    }
  },

  unassignSlotVehicle: async (vehicleId) => {
    const { activeOrderId, orderVehicles } = get();
    if (!activeOrderId) return;

    const prev = orderVehicles;
    set({
      orderVehicles: prev.map((v) =>
        v.id === vehicleId ? { ...v, assigned_to: null } : v,
      ),
    });
    try {
      await updateOrderVehicle(activeOrderId, vehicleId, { assigned_to: null });
    } catch {
      set({ orderVehicles: prev });
      toastError("Failed to unassign vehicle");
    }
  },

  uncompleteSlotVehicle: async (vehicleId) => {
    const { activeOrderId, orderVehicles } = get();
    if (!activeOrderId) return;

    const prev = orderVehicles;
    set({
      orderVehicles: prev.map((v) =>
        v.id === vehicleId ? { ...v, completed: false } : v,
      ),
    });
    try {
      await updateOrderVehicle(activeOrderId, vehicleId, { completed: false });
    } catch {
      set({ orderVehicles: prev });
      toastError("Failed to un-complete vehicle");
    }
  },

  addSlotItem: async (itemId, vehicleId, slotIndex) => {
    const { activeOrderId } = get();
    if (!activeOrderId) return;

    try {
      await addOrderItem(activeOrderId, {
        item_id: itemId,
        vehicle_id: vehicleId,
        slot_index: slotIndex,
      });
      await refreshOrderItems(activeOrderId);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      toastError(status === 409 ? "Vehicle full" : "Failed to add item");
    }
  },

  moveSlotItem: async (itemId, vehicleId, slotIndex) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({
      orderItems: prev.map((i) =>
        i.id === itemId ? { ...i, vehicle_id: vehicleId, slot_index: slotIndex } : i,
      ),
    });
    try {
      await moveOrderItem(activeOrderId, itemId, {
        vehicle_id: vehicleId,
        slot_index: slotIndex,
      });
      await refreshOrderItems(activeOrderId);
    } catch (err: unknown) {
      set({ orderItems: prev });
      const status = (err as { response?: { status?: number } }).response?.status;
      toastError(status === 409 ? "Vehicle full" : "Failed to move item");
    }
  },

  removeSlotItem: async (itemId) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({ orderItems: prev.filter((i) => i.id !== itemId) });
    try {
      await removeOrderItem(activeOrderId, itemId);
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderItems: prev });
      toastError("Failed to remove item");
    }
  },

  assignSlotItem: async (itemId, userId) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({
      orderItems: prev.map((i) => (i.id === itemId ? { ...i, assigned_to: userId } : i)),
    });
    try {
      await moveOrderItem(activeOrderId, itemId, { assigned_to: userId });
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderItems: prev });
      toastError("Failed to assign item");
    }
  },

  completeSlotItem: async (itemId, userId) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({
      orderItems: prev.map((i) =>
        i.id === itemId ? { ...i, assigned_to: userId, completed: true } : i,
      ),
    });
    try {
      await moveOrderItem(activeOrderId, itemId, { assigned_to: userId, completed: true });
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderItems: prev });
      toastError("Failed to complete item");
    }
  },

  unassignSlotItem: async (itemId) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({
      orderItems: prev.map((i) => (i.id === itemId ? { ...i, assigned_to: null } : i)),
    });
    try {
      await moveOrderItem(activeOrderId, itemId, { assigned_to: null });
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderItems: prev });
      toastError("Failed to unassign item");
    }
  },

  uncompleteSlotItem: async (itemId) => {
    const { activeOrderId, orderItems } = get();
    if (!activeOrderId) return;

    const prev = orderItems;
    set({
      orderItems: prev.map((i) => (i.id === itemId ? { ...i, completed: false } : i)),
    });
    try {
      await moveOrderItem(activeOrderId, itemId, { completed: false });
      await refreshOrderItems(activeOrderId);
    } catch {
      set({ orderItems: prev });
      toastError("Failed to un-complete item");
    }
  },

  /* ── Stockpiles & catalog ────────────────────────────────────────── */

  fetchStockpiles: async (groupId, warId) => {
    try {
      const stockpiles = await listStockpiles(groupId, warId);
      set({ stockpiles });
    } catch {
      // Stockpiles may not exist yet, that's fine
      set({ stockpiles: [] });
    }
  },

  createNewStockpile: async (payload) => {
    try {
      const stockpile = await createStockpile(payload);
      set({ stockpiles: [...get().stockpiles, stockpile] });
      return stockpile;
    } catch {
      toastError("Failed to create stockpile");
      return null;
    }
  },

  removeStockpile: async (stockpileId) => {
    const prev = get().stockpiles;
    set({ stockpiles: prev.filter((s) => s.id !== stockpileId) });
    try {
      await deleteStockpile(stockpileId);
      return true;
    } catch {
      set({ stockpiles: prev });
      toastError("Failed to delete stockpile");
      return false;
    }
  },

  fetchCatalogData: async () => {
    set({ catalogLoading: true });
    try {
      const [vehicleDefs, backendItems, backendVehicleTypes] = await Promise.all([
        getVehicleDefinitions(),
        listBackendItems().catch(() => []),
        listBackendVehicleTypes().catch(() => []),
      ]);
      set({
        vehicleDefinitions: vehicleDefs,
        itemCatalog: backendItems.map(toFoxholeItem),
        backendItems,
        backendVehicleTypes,
        catalogLoading: false,
      });
    } catch {
      set({ catalogLoading: false });
    }
  },

  setCatalogFilter: (category) => set({ catalogFilter: category }),

  resolveItemId: async (item) => {
    const existing = get().backendItems.find((bi) => bi.code === item.displayId);
    if (existing) return existing.id;

    try {
      const created = await createBackendItem({
        code: item.displayId,
        name: item.itemName,
        category: item.categoryName,
        faction: FACTION_CODE_TO_ENUM[item.faction] ?? "NEUTRAL",
        stack_size: 1,
        crate_size: 1,
        produced_at: "FACTORY",
        icon_url: item.iconPath || null,
      });
      set({ backendItems: [...get().backendItems, created] });
      return created.id;
    } catch {
      // Someone else may have registered it concurrently — re-sync and retry once
      try {
        const items = await listBackendItems();
        set({ backendItems: items });
        return items.find((bi) => bi.code === item.displayId)?.id ?? null;
      } catch {
        return null;
      }
    }
  },

  resolveVehicleTypeId: async (def) => {
    const existing = get().backendVehicleTypes.find((bt) => bt.code === def.id);
    if (existing) return existing.id;

    try {
      const created = await createBackendVehicleType({
        code: def.id,
        name: def.name,
        category: def.category,
        faction: def.faction,
        produced_at: VEHICLE_CATEGORY_TO_FACILITY[def.category] ?? "FACTORY",
        cargo_slots: def.slotCount,
        icon_url: def.iconUrl || null,
      });
      set({ backendVehicleTypes: [...get().backendVehicleTypes, created] });
      return created.id;
    } catch {
      try {
        const types = await listBackendVehicleTypes();
        set({ backendVehicleTypes: types });
        return types.find((bt) => bt.code === def.id)?.id ?? null;
      } catch {
        return null;
      }
    }
  },

  reset: () =>
    set({
      orders: [],
      activeOrderId: null,
      resourceRequests: [],
      vehicleRequests: [],
      orderVehicles: [],
      orderItems: [],
      stockpiles: [],
      catalogFilter: "All",
      loading: false,
    }),
  };
});
