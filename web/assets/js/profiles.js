const badgeImages = {
  bot: {
    url: "https://cdn.discordapp.com/emojis/1108228682184654908.png",
    name: "Pridebot",
  },
  discord: {
    url: "https://cdn.discordapp.com/emojis/1108417509624926228.png",
    name: "Discord Staff",
  },
  devs: {
    url: "https://cdn.discordapp.com/emojis/1195877037034983515.png",
    name: "Developer",
  },
  oneyear: {
    url: "https://cdn.discordapp.com/emojis/1233274651153797120.png",
    name: "1 Year Anniversary",
  },
  support: {
    url: "https://cdn.discordapp.com/emojis/1197399653109473301.png",
    name: "Support Team",
  },
  vips: {
    url: "https://cdn.discordapp.com/emojis/1197328938788204586.png",
    name: "Verified",
  },
  partner: {
    url: "https://cdn.discordapp.com/emojis/1197394034310791272.png",
    name: "Partner",
  },
  donor: {
    url: "https://cdn.discordapp.com/emojis/1235074804726628465.png",
    name: "Donor",
  },
};

const API_BASE_URL = "";

const userCache = new Map();
async function formatBioText(text) {
  if (!text) return "";

  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, "{{LINK:$1}}");

  const mentionRegex = /&lt;@(\d{17,19})&gt;/g;
  const mentions = [...formatted.matchAll(mentionRegex)];

  const userPromises = mentions.map(async (match) => {
    const userId = match[1];
    if (userCache.has(userId)) {
      return { userId, username: userCache.get(userId) };
    }
    try {
      const response = await fetch(`${API_BASE_URL}/getUser/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        const username = userData.username || `User ${userId}`;
        userCache.set(userId, username);
        return { userId, username };
      }
    } catch (e) {
      console.log(`Could not fetch user ${userId}:`, e);
    }
    return { userId, username: `User` };
  });

  const users = await Promise.all(userPromises);

  users.forEach(({ userId, username }) => {
    const mentionPattern = new RegExp(`&lt;@${userId}&gt;`, "g");
    formatted = formatted.replace(
      mentionPattern,
      `<a href="https://discord.com/users/${userId}" target="_blank" rel="noopener noreferrer" class="user-mention">@${username}</a>`
    );
  });

  formatted = formatted.replace(
    /\|\|([^|]+)\|\|/g,
    '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'
  );

  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  formatted = formatted.replace(
    /\{\{LINK:(https?:\/\/[^\}]+)\}\}/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="bio-link">$1</a>'
  );

  formatted = formatted.replace(/\\n/g, "<br>");
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

document.addEventListener("DOMContentLoaded", async function () {
  const searched = window.location.pathname.split("/").pop();

  if (!searched || searched === "profiles" || searched === "") {
    showError(
      "No user ID or username provided. Please access via profile.pridebot.xyz/{userId or username}"
    );
    return;
  }

  console.log(`Loading profile for: ${searched}`);
  await loadProfile(searched);
});

async function loadProfile(searchedValue) {
  const loadingContainer = document.getElementById("loading-container");
  const profileContent = document.getElementById("profile-content");
  const errorState = document.getElementById("error-state");

  try {
    const response = await fetch(`${API_BASE_URL}/profile/${searchedValue}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("This user hasn't set up a profile yet.");
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const profile = await response.json();
    console.log("Profile data:", profile);
    const userId = profile.userId;

    let discordUser = null;
    try {
      const userResponse = await fetch(`${API_BASE_URL}/getUser/${userId}`);
      if (userResponse.ok) {
        discordUser = await userResponse.json();
        console.log("Discord user data:", discordUser);
      }
    } catch (e) {
      console.log("Could not fetch Discord user info:", e);
    }

    let userBadges = [];
    try {
      const badgesResponse = await fetch(`${API_BASE_URL}/badges/${userId}`);
      if (badgesResponse.ok) {
        const badgesData = await badgesResponse.json();
        userBadges = badgesData.badges || [];
        console.log("User badges:", userBadges);
      }
    } catch (e) {
      console.log("Could not fetch badges:", e);
    }

    if (profile.color) {
      document.documentElement.style.setProperty(
        "--profile-color",
        profile.color
      );
      document.documentElement.style.setProperty(
        "--profile-accent",
        profile.color
      );
      updateThemeColor(profile.color);
    }

    await populateProfile(profile, discordUser, userId, userBadges);
    updatePageMeta(profile, discordUser);

    loadingContainer.style.display = "none";
    profileContent.style.display = "block";
    profileContent.classList.add("fade-in");
  } catch (error) {
    console.error("Error loading profile:", error);
    loadingContainer.style.display = "none";
    showError(error.message);
  }
}

async function populateProfile(profile, discordUser, userId, userBadges) {
  const avatarEl = document.getElementById("profile-avatar");

  const defaultAvatar = "https://cdn.discordapp.com/embed/avatars/0.png";
  let fallbackAvatar = defaultAvatar;

  if (discordUser) {
    if (discordUser.displayAvatarURL) {
      fallbackAvatar = discordUser.displayAvatarURL;
    } else if (discordUser.avatar) {
      fallbackAvatar = `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png?size=512`;
    }
  }

  avatarEl.onerror = function () {
    console.log("Avatar failed to load, falling back to:", fallbackAvatar);
    if (this.src !== fallbackAvatar && this.src !== defaultAvatar) {
      this.src = fallbackAvatar;
    } else if (this.src !== defaultAvatar) {
      this.src = defaultAvatar;
    }
  };

  if (profile.pfp) {
    avatarEl.src = profile.pfp;
  } else {
    avatarEl.src = fallbackAvatar;
  }

  const nameEl = document.getElementById("profile-name");
  nameEl.textContent =
    profile.preferredName ||
    (discordUser ? discordUser.username : "Unknown User");

  const usernameEl = document.getElementById("profile-username");
  if (discordUser && discordUser.username) {
    usernameEl.textContent = `@${discordUser.username}`;
  } else {
    usernameEl.textContent = `ID: ${userId}`;
  }

  const pronounsEl = document.getElementById("profile-pronouns");
  if (profile.pronouns) {
    let pronounText = profile.pronouns;
    if (profile.otherPronouns) {
      pronounText += ` / ${profile.otherPronouns}`;
    }
    pronounsEl.innerHTML = `<span class="pronoun-badge">${pronounText}</span>`;
    pronounsEl.style.display = "flex";
  }

  if (profile.badgesVisible !== false && userBadges.length > 0) {
    const badgesEl = document.getElementById("profile-badges");
    userBadges.forEach((badgeKey) => {
      if (badgeImages[badgeKey]) {
        const badgeImg = document.createElement("img");
        badgeImg.src = badgeImages[badgeKey].url;
        badgeImg.alt = badgeImages[badgeKey].name;
        badgeImg.title = badgeImages[badgeKey].name;
        badgeImg.className = "profile-badge";
        badgesEl.appendChild(badgeImg);
      }
    });
  }

  if (profile.bio) {
    const bioSection = document.getElementById("bio-section");
    const bioEl = document.getElementById("profile-bio");
    const formattedBio = await formatBioText(profile.bio);
    bioEl.innerHTML = formattedBio;
    bioSection.style.display = "block";
  }
  if (profile.age && profile.age !== 0) {
    const ageCard = document.getElementById("age-card");
    document.getElementById("profile-age").textContent = profile.age;
    ageCard.style.display = "flex";
  }
  if (profile.sexuality) {
    const sexualityCard = document.getElementById("sexuality-card");
    let sexualityText = profile.sexuality;
    if (profile.otherSexuality) {
      sexualityText += ` / ${profile.otherSexuality}`;
    }
    document.getElementById("profile-sexuality").textContent = sexualityText;
    sexualityCard.style.display = "flex";
  }
  if (profile.romanticOrientation) {
    const romanticCard = document.getElementById("romantic-card");
    document.getElementById("profile-romantic").textContent =
      profile.romanticOrientation;
    romanticCard.style.display = "flex";
  }
  if (profile.gender) {
    const genderCard = document.getElementById("gender-card");
    let genderText = profile.gender;
    if (profile.otherGender) {
      genderText += ` / ${profile.otherGender}`;
    }
    document.getElementById("profile-gender").textContent = genderText;
    genderCard.style.display = "flex";
  }
  if (profile.premiumMember && profile.premiumVisible !== false) {
    const premiumCard = document.getElementById("premium-card");
    if (profile.premiumSince) {
      const since = new Date(profile.premiumSince);
      const days = Math.floor((Date.now() - since) / 86400000);
      document.getElementById("profile-premium").textContent = `${days} days`;
    } else {
      document.getElementById("profile-premium").textContent = "Active";
    }
    premiumCard.style.display = "flex";
  }

  if (profile.customAvatars && profile.customAvatars.length > 0) {
    const avatarsSection = document.getElementById("avatars-section");
    const avatarsGrid = document.getElementById("custom-avatars");

    profile.customAvatars.forEach((avatar) => {
      const avatarCard = document.createElement("div");
      avatarCard.className = "avatar-card";
      avatarCard.innerHTML = `
        <img src="${avatar.url}" alt="${avatar.label}" class="custom-avatar-img" />
        <span class="avatar-label">${avatar.label}</span>
      `;
      avatarCard.addEventListener("click", () => {
        window.open(avatar.url, "_blank");
      });
      avatarsGrid.appendChild(avatarCard);
    });

    avatarsSection.style.display = "block";
  }

  const linksSection = document.getElementById("links-section");
  const linksGrid = document.getElementById("profile-links");
  let hasLinks = false;

  if (profile.pronounpage) {
    const link = createLinkButton(
      "Pronoun Page",
      profile.pronounpage,
      "fa-user-tag"
    );
    linksGrid.appendChild(link);
    hasLinks = true;
  }

  if (profile.customWebsites && profile.customWebsites.length > 0) {
    profile.customWebsites.forEach((site) => {
      const link = createLinkButton(
        site.label,
        site.url,
        "fa-external-link-alt"
      );
      linksGrid.appendChild(link);
    });
    hasLinks = true;
  }

  if (hasLinks) {
    linksSection.style.display = "block";
  }
}

function createLinkButton(label, url, icon) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "link-button";
  link.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${label}</span>
  `;
  return link;
}

function updateThemeColor(color) {
  document.documentElement.style.setProperty("--profile-accent", color);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", color);
  }
}

function updatePageMeta(profile, discordUser) {
  const name =
    profile.preferredName || (discordUser ? discordUser.username : "User");
  document.title = `${name}'s Profile | Pridebot`;

  const ogTitle = document.querySelector('meta[name="og:title"]');
  const ogDesc = document.querySelector('meta[name="og:description"]');

  if (ogTitle) {
    ogTitle.setAttribute("content", `${name}'s Profile | Pridebot`);
  }

  if (ogDesc) {
    const desc = profile.bio
      ? profile.bio.substring(0, 150).replace(/\\n/g, " ") +
        (profile.bio.length > 150 ? "..." : "")
      : `View ${name}'s profile on Pridebot`;
    ogDesc.setAttribute("content", desc);
  }

  if (profile.pfp) {
    const ogImage = document.querySelector('meta[name="og:image"]');
    if (ogImage) {
      ogImage.setAttribute("content", profile.pfp);
    }
  }
}

function showError(message) {
  const loadingContainer = document.getElementById("loading-container");
  const errorState = document.getElementById("error-state");
  const errorMessage = document.getElementById("error-message");

  loadingContainer.style.display = "none";
  errorMessage.textContent = message;
  errorState.style.display = "block";
  errorState.classList.add("fade-in");
}
