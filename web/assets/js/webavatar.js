function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function createAvatarCard(file, imagePathBase, currentFormat) {
  const flagName = file.replace(/\.(png|webp)$/i, "");
  const fileExtension = file.match(/\.(png|webp)$/i)?.[1] || "png";

  const itemDiv = document.createElement("div");
  itemDiv.className = "col-lg-4 col-md-6 col-sm-12 item fade-in";
  itemDiv.style.animationDelay = `${Math.random() * 0.3}s`;

  const boxDiv = document.createElement("div");
  boxDiv.id = "features";
  boxDiv.className = "box";

  // Image container with loading state
  const imgContainer = document.createElement("div");
  imgContainer.style.position = "relative";
  imgContainer.style.marginBottom = "1.5rem";

  const imgElement = document.createElement("img");
  imgElement.src = `${imagePathBase}${file}`;
  imgElement.alt = `${flagName} pride flag avatar`;
  imgElement.style.cssText = `
    width: 160px;
    height: 160px;
    border-radius: 50%;
    object-fit: cover;
    transition: var(--transition);
    box-shadow: var(--shadow-md);
  `;

  // Add loading placeholder
  imgElement.addEventListener("load", () => {
    imgElement.style.opacity = "1";
  });

  imgElement.addEventListener("error", () => {
    imgElement.src = "https://via.placeholder.com/160x160/333/666?text=Error";
    imgElement.alt = "Failed to load avatar";
  });

  imgContainer.appendChild(imgElement);

  // Flag name with format badge
  const flagNameElement = document.createElement("h3");
  flagNameElement.className = "name";
  flagNameElement.innerHTML = `
    <strong>${flagName}</strong>
    <span class="format-badge" style="
      background: var(--main-color);
      color: white;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      margin-left: 0.5rem;
      font-weight: 500;
    ">${fileExtension.toUpperCase()}</span>
  `;

  // Enhanced button container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "btn-group";

  // View button with icon
  const viewButton = document.createElement("a");
  viewButton.href = `${imagePathBase}${file}`;
  viewButton.className = "btn btn-primary";
  viewButton.innerHTML = `
    <i class="fas fa-eye"></i>
    View Full Size
  `;
  viewButton.setAttribute("target", "_blank");
  viewButton.setAttribute("rel", "noopener noreferrer");

  // Download button with icon
  const downloadButton = document.createElement("a");
  downloadButton.href = `${imagePathBase}${file}`;
  downloadButton.download = file;
  downloadButton.className = "btn btn-secondary";
  downloadButton.innerHTML = `
    <i class="fas fa-download"></i>
    Download
  `;

  // Add buttons to container - View Full Size and Download on same line
  buttonContainer.appendChild(viewButton);
  buttonContainer.appendChild(downloadButton);

  boxDiv.appendChild(imgContainer);
  boxDiv.appendChild(flagNameElement);
  boxDiv.appendChild(buttonContainer);

  itemDiv.appendChild(boxDiv);
  return itemDiv;
}

document.addEventListener("DOMContentLoaded", async function () {
  const userId = window.location.pathname.split("/").pop();
  const imagePathBase = `${userId}/`;
  const galleryContainer = document.getElementById("avatar-grid");
  const loadingContainer = document.getElementById("loading-container");
  const emptyState = document.getElementById("empty-state");
  const paginationContainer = document.getElementById("pagination-container");

  let allAvatars = [];
  let filteredAvatars = [];
  let currentPage = 1;
  let currentFormat = "all";
  const avatarsPerPage = 12;

  // Initialize with basic user info (server-side rendering handles the complex user lookup)
  const displayName = capitalizeFirstLetter(userId);
  console.log(
    `Initializing page for user: ${userId} (display: ${displayName})`
  );

  // Set initial page title
  document.title = `${displayName}'s Pride Avatars | Pridebot`;

  // Enhanced avatar loading with better error handling
  async function loadAvatars() {
    try {
      console.log(`Loading avatars for user: ${userId}`);
      const response = await fetch(`/files/${userId}`);
      console.log(`Avatar files response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Avatar files data:", data);

      if (data.files && data.files.length > 0) {
        // Filter and sort avatars
        allAvatars = data.files
          .filter((file) => file.endsWith(".png") || file.endsWith(".webp"))
          .sort((a, b) => {
            // Sort by flag name, then by format (PNG first)
            const nameA = a.replace(/\.(png|webp)$/i, "");
            const nameB = b.replace(/\.(png|webp)$/i, "");
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            return a.endsWith(".png") ? -1 : 1;
          });

        filteredAvatars = [...allAvatars];

        // Hide loading, show content
        loadingContainer.style.display = "none";
        galleryContainer.style.display = "flex";
        paginationContainer.style.display = "block";

        displayAvatarCount(filteredAvatars.length, allAvatars.length);
        setupFormatFilters();
        renderPage(currentPage);
      } else {
        // Show empty state
        loadingContainer.style.display = "none";
        emptyState.style.display = "block";
      }
    } catch (error) {
      console.error("Error loading avatars:", error);

      // Show error state with detailed debugging info
      loadingContainer.style.display = "none";
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <div class="error-state">
          <h3>Failed to Load Avatars</h3>
          <p>Error: ${error.message}</p>
          <p>User ID: ${userId}</p>
          <p>API Endpoint: /files/${userId}</p>
          <details style="margin: 1rem 0; text-align: left;">
            <summary>Debug Information</summary>
            <pre style="background: var(--surface); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; overflow-x: auto;">
Current URL: ${window.location.href}
User ID: ${userId}
API Call: /files/${userId}
Error: ${error.stack || error.message}
Timestamp: ${new Date().toISOString()}
            </pre>
          </details>
          <button onclick="location.reload()" class="btn">
            <i class="fas fa-redo"></i> Try Again
          </button>
          <button onclick="testApiConnection()" class="btn" style="margin-left: 0.5rem;">
            <i class="fas fa-flask"></i> Test API
          </button>
        </div>
      `;
    }
  }

  // Test API connection function with comprehensive diagnostics
  window.testApiConnection = async function () {
    const results = [];
    const testEndpoints = [
      { url: '/files/testuser123', name: 'Test Files API' },
      { url: '/getUser/testuser123', name: 'Test User API' },
      { url: `/files/${userId}`, name: `Current User Files (${userId})` },
      { url: `/getUser/${userId}`, name: `Current User Info (${userId})` },
      { url: '/health', name: 'Health Check' }
    ];
    
    try {
      console.log('Running comprehensive API diagnostics...');
      results.push(`🔍 API Diagnostics for ${window.location.host}`);
      results.push(`📅 ${new Date().toLocaleString()}`);
      results.push('');
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
          
          const startTime = Date.now();
          const response = await fetch(endpoint.url, {
            headers: { 
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined // 5 second timeout
          });
          const responseTime = Date.now() - startTime;
          
          const contentType = response.headers.get('content-type');
          let responsePreview = '';
          
          try {
            const text = await response.text();
            if (text.startsWith('{') || text.startsWith('[')) {
              // Try to format JSON nicely
              try {
                const parsed = JSON.parse(text);
                responsePreview = JSON.stringify(parsed, null, 2);
              } catch {
                responsePreview = text;
              }
            } else {
              responsePreview = text.length > 200 ? text.substring(0, 200) + '...' : text;
            }
          } catch (e) {
            responsePreview = 'Unable to read response body';
          }
          
          results.push(`✅ ${endpoint.name}`);
          results.push(`   Status: ${response.status} ${response.statusText}`);
          results.push(`   Response Time: ${responseTime}ms`);
          results.push(`   Content-Type: ${contentType || 'Not specified'}`);
          results.push(`   Response: ${responsePreview}`);
          results.push('');
          
        } catch (error) {
          results.push(`❌ ${endpoint.name}`);
          results.push(`   Error: ${error.name}: ${error.message}`);
          results.push('');
        }
      }
      
    } catch (error) {
      results.push(`💥 Diagnostic Error: ${error.message}`);
    }
    
    const resultText = results.join('\n');
    console.log('API Test Results:', resultText);
    
    // Show results in console and alert
    alert("API Test Results:\n\n" + resultText);
  };

  // Initialize loading
  loadAvatars();

  function displayAvatarCount(filtered, total) {
    const avatarCount = document.querySelector("h2#avatar-title");
    if (avatarCount) {
      const formatText =
        currentFormat === "all" ? "" : ` (${currentFormat.toUpperCase()} only)`;
      avatarCount.innerHTML = `
        Pride Avatars
        <span style="font-size: 0.8em; color: var(--text-secondary); font-weight: 400;">
          (${filtered} of ${total} avatars${formatText})
        </span>
      `;
    }
  }

  function setupFormatFilters() {
    const formatButtons = document.querySelectorAll(".format-btn");

    formatButtons.forEach((button) => {
      button.addEventListener("click", () => {
        // Update active state
        formatButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        // Update current format and filter
        currentFormat = button.dataset.format;
        filterAvatars();
        currentPage = 1; // Reset to first page
        renderPage(currentPage);
      });
    });
  }

  function filterAvatars() {
    if (currentFormat === "all") {
      filteredAvatars = [...allAvatars];
    } else {
      filteredAvatars = allAvatars.filter((file) =>
        file.endsWith(`.${currentFormat}`)
      );
    }

    displayAvatarCount(filteredAvatars.length, allAvatars.length);
  }

  function renderPage(page) {
    galleryContainer.innerHTML = ""; // Clear current content

    const startIndex = (page - 1) * avatarsPerPage;
    const endIndex = startIndex + avatarsPerPage;
    const currentAvatars = filteredAvatars.slice(startIndex, endIndex);

    if (currentAvatars.length === 0) {
      galleryContainer.innerHTML = `
        <div class="col-12">
          <div class="empty-state">
            <h3>No ${currentFormat.toUpperCase()} Avatars Found</h3>
            <p>Try selecting a different format or check back later.</p>
          </div>
        </div>
      `;
      paginationContainer.style.display = "none";
      return;
    }

    // Render avatar cards
    currentAvatars.forEach((file, index) => {
      const card = createAvatarCard(file, imagePathBase, currentFormat);
      card.style.animationDelay = `${index * 0.1}s`;
      galleryContainer.appendChild(card);
    });

    paginationContainer.style.display = "flex";
    renderPagination();
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredAvatars.length / avatarsPerPage);

    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let paginationHTML = `
      <button id="prev-page" class="btn btn-dark" ${
        currentPage === 1 ? "disabled" : ""
      }>
        <i class="fas fa-chevron-left"></i> Previous
      </button>
      <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
      <button id="next-page" class="btn btn-dark" ${
        currentPage === totalPages ? "disabled" : ""
      }>
        Next <i class="fas fa-chevron-right"></i>
      </button>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // Add event listeners
    const prevButton = document.querySelector("#prev-page");
    const nextButton = document.querySelector("#next-page");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderPage(currentPage);
          // Smooth scroll to top of gallery
          galleryContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderPage(currentPage);
          // Smooth scroll to top of gallery
          galleryContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    }
  }

  // Keyboard navigation
  document.addEventListener("keydown", (event) => {
    const totalPages = Math.ceil(filteredAvatars.length / avatarsPerPage);

    if (event.key === "ArrowLeft" && currentPage > 1) {
      currentPage--;
      renderPage(currentPage);
      galleryContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (event.key === "ArrowRight" && currentPage < totalPages) {
      currentPage++;
      renderPage(currentPage);
      galleryContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
