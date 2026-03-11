(function () {
  const AUTH_BASE = "https://profile.pridebot.xyz";

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function parseJWT(token) {
    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  }

  function getAvatarURL(userId, avatarHash) {
    if (!avatarHash) {
      const index = (BigInt(userId) >> 22n) % 6n;
      return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=64`;
  }

  function injectStyles() {
    if (document.getElementById("user-nav-styles")) return;
    const style = document.createElement("style");
    style.id = "user-nav-styles";
    style.textContent = `
      .user-nav-container {
        position: relative;
        display: flex;
        align-items: center;
        margin-left: 12px;
      }
      .user-nav-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid rgba(255, 0, 234, 0.5);
        transition: border-color 0.2s, transform 0.2s;
        object-fit: cover;
      }
      .user-nav-avatar:hover {
        border-color: #ff00ea;
        transform: scale(1.08);
      }
      .user-nav-dropdown {
        display: none;
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 200px;
        background: #1a1a2e;
        border: 1px solid rgba(255, 0, 234, 0.2);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        padding: 8px 0;
        z-index: 9999;
        animation: userNavFadeIn 0.15s ease;
      }
      .user-nav-dropdown.show {
        display: block;
      }
      @keyframes userNavFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .user-nav-header {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .user-nav-header img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
      }
      .user-nav-header span {
        color: #fff;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .user-nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        color: rgba(255, 255, 255, 0.8);
        text-decoration: none;
        font-size: 0.85rem;
        transition: background 0.15s, color 0.15s;
      }
      .user-nav-link:hover {
        background: rgba(255, 0, 234, 0.1);
        color: #ff00ea;
      }
      .user-nav-link i {
        width: 16px;
        text-align: center;
        font-size: 0.9rem;
      }
      .user-nav-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 4px 0;
      }
      .user-nav-login {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: #5865F2;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.2s, transform 0.15s;
        margin-left: 12px;
        white-space: nowrap;
      }
      .user-nav-login:hover {
        background: #4752C4;
        transform: scale(1.03);
      }
      .user-nav-login i {
        font-size: 0.9rem;
      }
    `;
    document.head.appendChild(style);
  }

  function buildLoginButton() {
    const currentUrl = encodeURIComponent(window.location.href);
    const a = document.createElement("a");
    a.className = "user-nav-login";
    a.href = `${AUTH_BASE}/auth/discord?redirect=${currentUrl}`;
    a.innerHTML = '<i class="fab fa-discord"></i> Login';
    return a;
  }

  function buildUserDropdown(user) {
    const container = document.createElement("div");
    container.className = "user-nav-container";

    const avatar = document.createElement("img");
    avatar.className = "user-nav-avatar";
    avatar.src = getAvatarURL(user.id, user.avatar);
    avatar.alt = user.username;
    avatar.title = user.username;

    const dropdown = document.createElement("div");
    dropdown.className = "user-nav-dropdown";

    const currentUrl = encodeURIComponent(window.location.href);

    dropdown.innerHTML = `
      <div class="user-nav-header">
        <img src="${getAvatarURL(user.id, user.avatar)}" alt="" />
        <span>${user.username}</span>
      </div>
      <a class="user-nav-link" href="https://pfp.pridebot.xyz/${user.username}">
        <i class="fas fa-image"></i> My Avatars
      </a>
      <a class="user-nav-link" href="https://profile.pridebot.xyz/${user.id}">
        <i class="fas fa-user"></i> My Profile
      </a>
      <div class="user-nav-divider"></div>
      <a class="user-nav-link" href="${AUTH_BASE}/auth/logout?redirect=${currentUrl}">
        <i class="fas fa-sign-out-alt"></i> Logout
      </a>
    `;

    avatar.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      dropdown.classList.remove("show");
    });

    dropdown.addEventListener("click", (e) => e.stopPropagation());

    container.appendChild(avatar);
    container.appendChild(dropdown);
    return container;
  }

  function init() {
    injectStyles();

    const navbarNav =
      document.querySelector(".navbar-nav.ms-auto") ||
      document.querySelector(".navbar-nav#nav-menu") ||
      document.querySelector(".navbar-nav");

    if (!navbarNav) return;

    const token = getCookie("pridebot_token");
    const user = token ? parseJWT(token) : null;

    if (user && user.id && user.exp * 1000 > Date.now()) {
      navbarNav.appendChild(buildUserDropdown(user));
    } else {
      navbarNav.appendChild(buildLoginButton());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
