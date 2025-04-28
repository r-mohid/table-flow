document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/statistics-data");
    const stats = await res.json();

    document.getElementById('totalOrders').textContent = stats.totalOrders || 0;
    document.getElementById('revenueToday').textContent = stats.revenueToday.toFixed(2);
    document.getElementById('revenueTotal').textContent = stats.revenueTotal.toFixed(2);

    const topMenuItems = document.getElementById('topMenuItems');
    stats.topMenuItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name} - ${item.count} orders`;
      topMenuItems.appendChild(li);
    });

    const ingredientUsage = document.getElementById('ingredientUsage');
    Object.entries(stats.ingredientUsage).forEach(([name, qty]) => {
      const li = document.createElement('li');
      li.textContent = `${name} - ${qty} used`;
      ingredientUsage.appendChild(li);
    });

    const stockAlerts = document.getElementById('stockAlerts');
    stats.stockAlerts.forEach(alert => {
      const li = document.createElement('li');
      li.textContent = `⚠️ ${alert.name} low stock (${alert.quantity} left)`;
      stockAlerts.appendChild(li);
    });

  } catch (err) {
    console.error("Failed to load statistics:", err);
  }
});
