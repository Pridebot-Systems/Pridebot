document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const resultContainer = document.getElementById("search-result");
  const searchButton = document.querySelector(".search-button");
  const buttonText = document.querySelector(".button-text");
  const buttonIcon = document.querySelector(".button-icon");

  let searchTimeout;

  // Add loading state management
  function setLoadingState(isLoading) {
    if (isLoading) {
      searchButton.disabled = true;
      buttonText.textContent = "Searching";
      buttonIcon.className = "fas fa-spinner fa-spin";
      resultContainer.className = "search-result loading";
      resultContainer.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Searching for avatars...</span>
      `;
    } else {
      searchButton.disabled = false;
      buttonText.textContent = "Search";
      buttonIcon.className = "fas fa-arrow-right button-icon";
    }
  }

  // Enhanced error display
  function showError(message, suggestion = null) {
    resultContainer.className = "search-result error fade-in";
    resultContainer.innerHTML = `
      <div>
        <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
        <p style="margin: 0;">${message}</p>
        ${suggestion ? `<small style="opacity: 0.8; margin-top: 0.5rem; display: block;">${suggestion}</small>` : ''}
      </div>
    `;
  }

  // Enhanced success display
  function showSuccess(message) {
    resultContainer.className = "search-result success fade-in";
    resultContainer.innerHTML = `
      <div>
        <i class="fas fa-check-circle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
        <p style="margin: 0;">${message}</p>
      </div>
    `;
  }

  // Clear results
  function clearResults() {
    resultContainer.className = "search-result";
    resultContainer.innerHTML = "";
  }

  // Input validation with visual feedback
  function validateInput(query) {
    if (!query) {
      showError("Please enter a username or user ID", "Try something like 'john123' or '123456789012345678'");
      return false;
    }

    if (query.length < 2) {
      showError("Search term too short", "Please enter at least 2 characters");
      return false;
    }

    if (query.length > 32) {
      showError("Search term too long", "Please enter less than 32 characters");
      return false;
    }

    // Check for suspicious characters
    if (!/^[a-zA-Z0-9_.-]+$/.test(query)) {
      showError("Invalid characters detected", "Only letters, numbers, underscores, periods, and hyphens are allowed");
      return false;
    }

    return true;
  }

  // Enhanced search logic
  async function performSearch(query) {
    try {
      setLoadingState(true);
      
      // First, try direct user ID lookup (numeric)
      if (/^\d+$/.test(query)) {
        // It's a user ID, try direct access
        const response = await fetch(`/files/${query}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.files && data.files.length > 0) {
            const avatarCount = data.files.filter(f => f.endsWith('.png') || f.endsWith('.webp')).length;
            showSuccess(`Found ${avatarCount} avatars! Redirecting...`);
            
            setTimeout(() => {
              window.location.href = `/${query}`;
            }, 1000);
            return;
          }
        }
      }
      
      // Try username lookup
      const usernameResponse = await fetch(`/files/${query.toLowerCase()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (usernameResponse.ok) {
        const data = await usernameResponse.json();
        if (data.files && data.files.length > 0) {
          const avatarCount = data.files.filter(f => f.endsWith('.png') || f.endsWith('.webp')).length;
          showSuccess(`Found ${avatarCount} avatars for username! Redirecting...`);
          
          setTimeout(() => {
            window.location.href = `/${query.toLowerCase()}`;
          }, 1000);
          return;
        }
      }

      // No results found
      showError(
        "No avatars found for this user", 
        "Make sure the username or user ID is correct, or ask them to generate some avatars with /prideavatar"
      );

    } catch (error) {
      console.error("Search error:", error);
      showError(
        "Search temporarily unavailable", 
        "Please try again in a moment or check your internet connection"
      );
    } finally {
      setLoadingState(false);
    }
  }

  // Real-time input feedback
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    
    // Clear any existing timeout
    clearTimeout(searchTimeout);
    
    if (query === "") {
      clearResults();
      return;
    }

    // Debounced validation
    searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        // Show typing indicator
        resultContainer.className = "search-result";
        resultContainer.innerHTML = `
          <div style="color: var(--text-muted); font-size: 0.9rem;">
            <i class="fas fa-keyboard" style="margin-right: 0.5rem;"></i>
            Ready to search for "${query}"
          </div>
        `;
      }
    }, 300);
  });

  // Enhanced form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();

    if (!validateInput(query)) {
      return;
    }

    await performSearch(query);
  });

  // Add keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearResults();
      searchInput.blur();
    }
    
    if (event.ctrlKey && event.key === "k") {
      event.preventDefault();
      searchInput.focus();
    }
  });

  // Add focus management
  searchInput.addEventListener("focus", () => {
    document.querySelector(".search-input-container").style.transform = "scale(1.02)";
  });

  searchInput.addEventListener("blur", () => {
    document.querySelector(".search-input-container").style.transform = "scale(1)";
  });

  // Auto-focus search input on page load
  setTimeout(() => {
    searchInput.focus();
  }, 500);
});
