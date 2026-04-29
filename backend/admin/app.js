function qs(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")} ${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function buildMetricCard(label, value) {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildRows(items, renderRow) {
  if (!items.length) {
    return `<tr><td colspan="7" class="empty">暂无数据</td></tr>`;
  }
  return items.map(renderRow).join("");
}

async function fetchSnapshot() {
  const response = await fetch("/api/admin/snapshot");
  if (!response.ok) {
    throw new Error("拉取后台数据失败");
  }
  return response.json();
}

async function resetData() {
  const confirmed = window.confirm("确认重置本地测试数据吗？");
  if (!confirmed) return;
  const response = await fetch("/api/admin/reset", {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("重置失败");
  }
  await loadDashboard();
}

async function loadDashboard() {
  const snapshot = await fetchSnapshot();

  qs("#metrics").innerHTML = [
    buildMetricCard("会话数", snapshot.counts.sessions),
    buildMetricCard("家庭成员", snapshot.counts.members),
    buildMetricCard("猫咪档案", snapshot.counts.pets),
    buildMetricCard("健康记录", snapshot.counts.records)
  ].join("");

  qs("#timestamp").textContent = `最后刷新：${formatDateTime(snapshot.generatedAt)}`;

  qs("#authCard").innerHTML = `
    <div class="section-label">Auth</div>
    <h2>当前登录态</h2>
    <ul>
      <li>是否登录：${snapshot.auth.isLoggedIn ? "是" : "否"}</li>
      <li>当前猫咪：${escapeHtml(snapshot.auth.currentPetId || "--")}</li>
      <li>完成引导：${snapshot.auth.hasCompletedOnboarding ? "是" : "否"}</li>
      <li>用户昵称：${escapeHtml(snapshot.auth.user.nickname || "--")}</li>
    </ul>
  `;

  qs("#reminderCard").innerHTML = `
    <div class="section-label">Reminder</div>
    <h2>提醒设置</h2>
    <ul>
      <li>疫苗提醒：${snapshot.reminderSettings.vaccineEnabled ? "开启" : "关闭"}</li>
      <li>驱虫提醒：${snapshot.reminderSettings.dewormEnabled ? "开启" : "关闭"}</li>
      <li>提前天数：${escapeHtml(snapshot.reminderSettings.leadDays)} 天</li>
    </ul>
  `;

  qs("#sessionsBody").innerHTML = buildRows(snapshot.sessions, (item) => `
    <tr>
      <td class="mono">${escapeHtml(item.token)}</td>
      <td>${escapeHtml(item.userId)}</td>
      <td>${escapeHtml(item.identityHint || "--")}</td>
      <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
      <td>${escapeHtml(formatDateTime(item.expiresAt))}</td>
    </tr>
  `);

  qs("#membersBody").innerHTML = buildRows(snapshot.members, (item) => `
    <tr>
      <td class="mono">${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.displayName)}</td>
      <td><span class="pill ${item.role === "owner" ? "primary" : "success"}">${escapeHtml(item.role)}</span></td>
      <td class="mono">${escapeHtml(item.familyId)}</td>
      <td>${escapeHtml(item.joinedAt)}</td>
    </tr>
  `);

  qs("#petsBody").innerHTML = buildRows(snapshot.pets, (item) => `
    <tr>
      <td class="mono">${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.breed)}</td>
      <td>${escapeHtml(item.birthday)}</td>
      <td>${escapeHtml(item.gender)}</td>
      <td>${item.isNeutered ? "已绝育" : "未绝育"}</td>
      <td class="mono">${escapeHtml(item.familyId)}</td>
    </tr>
  `);

  qs("#recordsBody").innerHTML = buildRows(snapshot.records, (item) => {
    const mainText =
      item.type === "vaccine"
        ? item.vaccineName
        : item.type === "deworm"
          ? `${item.mode === "internal" ? "体内" : "体外"} · ${item.brand || "--"}`
          : `${item.weightKg} kg`;
    const dateText =
      item.type === "vaccine" ? item.vaccinatedAt : item.type === "deworm" ? item.executedAt : item.recordedAt;
    const nextText = item.nextDueAt || "--";
    return `
      <tr>
        <td class="mono">${escapeHtml(item.id)}</td>
        <td class="mono">${escapeHtml(item.petId)}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(mainText || "--")}</td>
        <td>${escapeHtml(dateText || "--")}</td>
        <td>${escapeHtml(nextText)}</td>
        <td>${escapeHtml(item.note || "--")}</td>
      </tr>
    `;
  });
}

qs("#refreshBtn").addEventListener("click", () => {
  loadDashboard().catch((error) => {
    window.alert(error.message || "刷新失败");
  });
});

qs("#resetBtn").addEventListener("click", () => {
  resetData().catch((error) => {
    window.alert(error.message || "重置失败");
  });
});

loadDashboard().catch((error) => {
  window.alert(error.message || "加载后台失败");
});
