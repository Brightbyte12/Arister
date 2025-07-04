const Settings = require("../models/Settings");

const isCodAvailable = async ({ orderValue, pincode, state, city, items, orderTime }) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.cod.enabled) {
      return { available: false, reason: "COD is disabled" };
    }

    const { rules } = settings.cod;

    // Check order value restrictions
    if (orderValue < rules.minOrderValue) {
      return { available: false, reason: `Order value ₹${orderValue} is below minimum ₹${rules.minOrderValue}` };
    }
    if (rules.maxOrderValue && orderValue > rules.maxOrderValue) {
      return { available: false, reason: `Order value ₹${orderValue} exceeds maximum ₹${rules.maxOrderValue}` };
    }

    // Check location restrictions
    if (rules.excludedPincodes.includes(pincode)) {
      return { available: false, reason: `COD not available for pincode ${pincode}` };
    }
    if (rules.excludedStates.includes(state)) {
      return { available: false, reason: `COD not available for state ${state}` };
    }

    // Check time restrictions
    if (rules.timeRestrictions.enabled) {
      const now = new Date(orderTime);
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      const currentDay = now.getDay();
      if (rules.timeRestrictions.daysOfWeek.length > 0 && !rules.timeRestrictions.daysOfWeek.includes(currentDay)) {
        return { available: false, reason: "COD not available on this day" };
      }
      if (currentTime < rules.timeRestrictions.startTime || currentTime > rules.timeRestrictions.endTime) {
        return { available: false, reason: "COD not available at this time" };
      }
    }

    // Check product restrictions
    const excludedProducts = rules.excludedProducts || [];
    const excludedCategories = rules.excludedCategories || [];
    for (const item of items) {
      if (excludedProducts.includes(item.id)) {
        return { available: false, reason: `COD not available for product ${item.name}` };
      }
      // Note: Category check requires item.category, which is not in CartItem interface
      // Add category to CartItem or fetch product details if needed
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking COD availability:", error);
    return { available: false, reason: "Failed to check COD availability" };
  }
};

const calculateCodCharge = async ({ orderValue, pincode, state, city, courierCode }) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.cod.enabled) {
      return 0;
    }

    const { pricing } = settings.cod;

    // Location-based pricing
    if (pricing.locationBased.enabled) {
      const zone = pricing.locationBased.zones.find(
        (z) => z.pincodes.includes(pincode) || z.states.includes(state) || z.cities.includes(city)
      );
      if (zone) {
        let charge = zone.charge;
        if (pricing.type === "percentage") {
          charge = Math.max(zone.minCharge, Math.min(zone.maxCharge, (orderValue * pricing.percentage) / 100));
        }
        return charge;
      }
    }

    // Courier-specific charges
    if (courierCode && settings.cod.courierCharges.enabled) {
      const courier = settings.cod.courierCharges.couriers.find((c) => c.code === courierCode && c.enabled);
      if (courier) {
        return Math.max(courier.minCharge, Math.min(courier.maxCharge, (orderValue * courier.percentage) / 100));
      }
    }

    // Tiered pricing
    if (pricing.type === "tiered") {
      const tier = pricing.tiers.find(
        (t) => orderValue >= t.minAmount && (!t.maxAmount || orderValue <= t.maxAmount)
      );
      if (tier) {
        return tier.charge;
      }
    }

    // Percentage-based pricing
    if (pricing.type === "percentage") {
      return Math.max(pricing.minCharge, Math.min(pricing.maxCharge, (orderValue * pricing.percentage) / 100));
    }

    // Fixed pricing
    return pricing.fixedAmount;
  } catch (error) {
    console.error("Error calculating COD charge:", error);
    return 0;
  }
};

const getCodSummary = async () => {
  const settings = await Settings.findOne();
  if (!settings || !settings.cod) {
    return {
      totalCodOrders: 0,
      totalCodRevenue: 0,
      averageCodCharge: 0,
      lastUpdated: null,
    };
  }
  return settings.cod.analytics || {
    totalCodOrders: 0,
    totalCodRevenue: 0,
    averageCodCharge: 0,
    lastUpdated: null,
  };
};

module.exports = {
  isCodAvailable,
  calculateCodCharge,
  getCodSummary,
};