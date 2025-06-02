

// Common functions for quiz creation and editing
function setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(() => {
        if (isHasUnsavedChanges()) {
            saveDraft();
        }
    }, 30000);
    
    // Save on quiz title change
    document.getElementById('quizTitle').addEventListener('input', () => {
        triggerAutoSave();
    });
    
    // Save on mode/language change
    document.getElementById('quizMode').addEventListener('change', () => {
        triggerAutoSave();
    });
    
    document.getElementById('quizLanguage').addEventListener('change', () => {
        triggerAutoSave();
    });
}

function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveDraft();
    }, 2000);
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

function toggleScheduleSettings() {
    const mode = document.getElementById('quizMode').value;
    const scheduleSettings = document.getElementById('scheduleSettings');
    
    if (mode === 'offline') {
        scheduleSettings.style.display = 'block';
    } else {
        scheduleSettings.style.display = 'none';
    }
    triggerAutoSave();
}

function moveQuestion(num, direction) {
    const idx = questions.findIndex(q => q.id === num);
    if (idx === -1) return;

    let newIdx = idx;
    if (direction === 'up' && idx > 0) {
        newIdx = idx - 1;
    } else if (direction === 'down' && idx < questions.length - 1) {
        newIdx = idx + 1;
    } else {
        showNotification(
            `Cannot move ${direction}. Question is already at the ${direction === 'up' ? 'top' : 'bottom'}.`,
            'warning'
        );
        return;
    }

    // Add transitioning class to maintain button visibility
    const allCards = document.querySelectorAll('.question-card-modern');
    allCards.forEach(card => card.classList.add('transitioning'));

    // Swap in array
    const temp = questions[idx];
    questions[idx] = questions[newIdx];
    questions[newIdx] = temp;

    // Re-render all questions in new order
    renderAllQuestions();

    // Scroll and highlight the moved question
    setTimeout(() => {
        // Remove transitioning class
        const updatedCards = document.querySelectorAll('.question-card-modern');
        updatedCards.forEach(card => {
            card.classList.remove('transitioning', 'active-question', 'recently-moved');
        });

        const movedCard = document.getElementById(`question-${newIdx + 1}`);
        if (movedCard) {
            // Add visual feedback classes
            movedCard.classList.add('recently-moved', 'active-question');
            
            // Scroll so the moved question's header is visible
            const header = movedCard.querySelector('.question-header');
            if (header) {
                const rect = header.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                window.scrollTo({
                    top: rect.top + scrollTop - 20, // Small offset from top
                    behavior: 'smooth'
                });
            }

            // Keep the action buttons visible for longer
            setTimeout(() => {
                movedCard.classList.remove('recently-moved');
            }, 2000);

            // Remove active state after a delay
            setTimeout(() => {
                movedCard.classList.remove('active-question');
            }, 3000);
        }
    }, 100);

    triggerAutoSave();
    showNotification(`Question moved ${direction} successfully!`, 'success');
}

function updateQuestionCount() {
    const countElement = document.getElementById('questionCount');
    const countDisplayElement = document.getElementById('questionCountDisplay');
    
    if (countElement) {
        countElement.textContent = questions.length;
    }
    if (countDisplayElement) {
        countDisplayElement.textContent = questions.length;
    }
    
    // Update estimated duration
    const estimatedElement = document.getElementById('estimatedDuration');
    if (estimatedElement) {
        const minutes = Math.round(questions.length * 1.5);
        estimatedElement.textContent = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)}h ${minutes%60}m`;
    }
}

function duplicateQuestion(num) {
    const idx = questions.findIndex(q => q.id === num);
    if (idx === -1) return;
    
    questionCount++;
    const original = questions[idx];
    // Deep clone options
    const newQuestion = {
        ...JSON.parse(JSON.stringify(original)),
        id: questionCount,
        content: original.content + ' (Copy)'
    };
    
    questions.splice(idx + 1, 0, newQuestion);
    renderAllQuestions();
    updateQuestionCount();
    triggerAutoSave();
    
    showNotification('Question duplicated successfully!', 'success');
    
    // Highlight the duplicated question
    setTimeout(() => {
        const duplicatedCard = document.getElementById(`question-${idx + 2}`);
        if (duplicatedCard) {
            duplicatedCard.classList.add('recently-moved', 'active-question');
            duplicatedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                duplicatedCard.classList.remove('recently-moved');
            }, 2000);
            
            setTimeout(() => {
                duplicatedCard.classList.remove('active-question');
            }, 4000);
        }
    }, 200);
}

function renderAllQuestions() {
    const container = document.getElementById('questionsContainer');
    
    // Store scroll position
    const scrollPosition = window.scrollY;
    
    container.innerHTML = '';
    
    questions.forEach((q, idx) => {
        q.id = idx + 1;
        container.insertAdjacentHTML('beforeend', createQuestionHtml(q.id));
    });
    
    // Restore values for each question
    questions.forEach((q, idx) => {
        const id = idx + 1;
        const contentEl = document.getElementById(`question-${id}-content`);
        if (contentEl) contentEl.value = q.content;
        
        const typeEl = document.getElementById(`question-${id}-type`);
        if (typeEl) {
            typeEl.value = q.type;
            toggleQuestionType(id, q.type);
        }
        
        // Restore options
        if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
            ['A', 'B', 'C', 'D'].forEach((letter, i) => {
                const optEl = document.getElementById(`option-${id}-${letter}`);
                if (optEl) optEl.value = q.options[i] || '';
            });
            if (q.correctAnswer) selectCorrectAnswer(id, q.correctAnswer);
        }
        
        // Restore image preview if available
        if (q.image && q.image.preview) {
            const uploadZone = document.querySelector(`#question-${id} .image-upload-zone`);
            if (uploadZone) {
                uploadZone.classList.add('has-image');
                uploadZone.innerHTML = `
                    <img src="${q.image.preview}" alt="Question Image" 
                         style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="removeImage(${id}, event)" type="button">
                            <i class="fas fa-trash me-1"></i> Remove
                        </button>
                    </div>
                `;
            }
        }
    });
    
    questionCount = questions.length;
    updateQuestionCount();
    
    // Restore approximate scroll position
    window.scrollTo(0, scrollPosition);
}

function renumberQuestions() {
    const questionElements = document.querySelectorAll('.question-card-modern');
    questionElements.forEach((element, index) => {
        const newNum = index + 1;
        
        // Update element ID
        element.id = `question-${newNum}`;
        
        // Update question number display
        const numberDisplay = element.querySelector('.question-number');
        if (numberDisplay) numberDisplay.textContent = newNum;
        
        // Update heading
        const heading = element.querySelector('h5');
        if (heading) heading.textContent = `Question ${newNum}`;
        
        // Update all form element IDs and event handlers
        updateQuestionElementIds(element, newNum);
        
        // Update questions array
        if (questions[index]) {
            questions[index].id = newNum;
        }
    });
    
    questionCount = questionElements.length;
}
// =================== QUESTION MANAGEMENT ===================

function createQuestionHtml(num) {
    return `
        <div class="question-card-modern animate-slide-up" id="question-${num}">
            <div class="question-header">
                <div class="d-flex align-items-center flex-grow-1">
                    <div class="question-number">${num}</div>
                    <h5 class="mb-0">Question ${num}</h5>
                </div>
                
                <!-- Action Buttons -->
                <div class="question-actions">
                    <button class="action-btn" 
                            onclick="moveQuestion(${num}, 'up')" 
                            title="Move Up"
                            type="button">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="action-btn" 
                            onclick="moveQuestion(${num}, 'down')" 
                            title="Move Down"
                            type="button">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button class="action-btn" 
                            onclick="duplicateQuestion(${num})" 
                            title="Duplicate Question"
                            type="button">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn danger" 
                            onclick="deleteQuestion(${num})" 
                            title="Delete Question"
                            type="button">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="card-body-modern">
                <div class="row">
                    <div class="col-lg-8">
                        <div class="form-floating-modern">
                            <textarea class="form-control-modern" 
                                      id="question-${num}-content" 
                                      placeholder=" " 
                                      rows="3" 
                                      oninput="updateQuestion(${num}, 'content', this.value)"></textarea>
                            <label class="form-label-modern">Question Content</label>
                        </div>
                        
                        <div class="form-floating-modern">
                            <select class="form-control-modern" 
                                    id="question-${num}-type" 
                                    onchange="toggleQuestionType(${num}, this.value)">
                                <option value="multiple_choice">Multiple Choice A/B/C/D</option>
                                <option value="text_input">Text Input</option>
                            </select>
                            <label class="form-label-modern">Question Type</label>
                        </div>
                    </div>
                    
                    <div class="col-lg-4">
                        <div class="image-upload-zone" onclick="document.getElementById('image-${num}').click()">
                            <input type="file" 
                                   id="image-${num}" 
                                   accept="image/*" 
                                   style="display: none;" 
                                   onchange="handleImageUpload(${num}, this)">
                            <div class="upload-content">
                                <div class="upload-icon">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                </div>
                                <h6>Upload Image</h6>
                                <p class="text-muted small mb-0">Click to select image</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="answer-options" id="options-${num}">
                    <h6 class="text-primary mb-3">Answer Options</h6>
                    ${createOptionsHtml(num)}
                </div>
            </div>
        </div>
    `;
}

function createOptionsHtml(questionNum) {
    const letters = ['A', 'B', 'C', 'D'];
    return letters.map(letter => `
        <div class="option-group">
            <div class="option-radio" id="radio-${questionNum}-${letter}" 
                 onclick="selectCorrectAnswer(${questionNum}, '${letter}')"></div>
            <div class="option-letter">${letter}</div>
            <input type="text" class="form-control-modern flex-grow-1" 
                   placeholder="Enter option ${letter}" 
                   id="option-${questionNum}-${letter}"
                   oninput="updateQuestion(${questionNum}, 'option${letter}', this.value)">
        </div>
    `).join('');
}

function updateQuestion(num, field, value) {
    const question = questions.find(q => q.id === num);
    if (question) {
        if (question.type === 'multiple_choice') {
            if (!Array.isArray(question.options) || question.options.length !== 4) {
                question.options = Array.isArray(question.options)
                    ? [...question.options, '', '', '', ''].slice(0, 4)
                    : ['', '', '', ''];
            }
        }
        if (field.startsWith('option')) {
            const index = field.charCodeAt(6) - 65; // Convert A,B,C,D to 0,1,2,3
            if (!Array.isArray(question.options)) {
                question.options = ['', '', '', ''];
            }
            question.options[index] = value;
        } else {
            question[field] = value;
        }
        triggerAutoSave();
    }
}

function selectCorrectAnswer(questionNum, letter) {
    const letters = ['A', 'B', 'C', 'D'];
    letters.forEach(l => {
        const radioElement = document.getElementById(`radio-${questionNum}-${l}`);
        if (radioElement) {
            radioElement.classList.remove('checked');
        }
    });
    
    const selectedRadio = document.getElementById(`radio-${questionNum}-${letter}`);
    if (selectedRadio) {
        selectedRadio.classList.add('checked');
    }
    
    updateQuestion(questionNum, 'correctAnswer', letter);
}

function toggleQuestionType(num, type) {
    const optionsContainer = document.getElementById(`options-${num}`);
    updateQuestion(num, 'type', type);
    
    if (type === 'text_input') {
        optionsContainer.innerHTML = `
            <h6 class="text-primary mb-3">Text Answer Settings</h6>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Students will type their answer in a text field.
            </div>
        `;
    } else {
        optionsContainer.innerHTML = `
            <h6 class="text-primary mb-3">Answer Options</h6>
            ${createOptionsHtml(num)}
        `;
        
        const question = questions.find(q => q.id === num);
        if (question) {
            ['A', 'B', 'C', 'D'].forEach((letter, index) => {
                const input = document.getElementById(`option-${num}-${letter}`);
                if (input && question.options[index]) {
                    input.value = question.options[index];
                }
            });
            
            if (question.correctAnswer) {
                selectCorrectAnswer(num, question.correctAnswer);
            }
        }
    }
}

function handleImageUpload(num, input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const question = questions.find(q => q.id === num);
            if (question) {
                question.image = {
                    file: file,
                    preview: e.target.result
                };
                const uploadZone = document.querySelector(`#question-${num} .image-upload-zone`);
                if (uploadZone) {
                    uploadZone.classList.add('has-image');
                    uploadZone.innerHTML = `
                        <img src="${e.target.result}" alt="Question Image" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-danger" onclick="removeImage(${num}, event)" type="button">
                                <i class="fas fa-trash me-1"></i> Remove
                            </button>
                        </div>
                    `;
                }
                triggerAutoSave();
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(num, event) {
    if (event) event.stopPropagation();
    const question = questions.find(q => q.id === num);
    if (question) {
        question.image = null;
        const uploadZone = document.querySelector(`#question-${num} .image-upload-zone`);
        if (uploadZone) {
            uploadZone.classList.remove('has-image');
            uploadZone.innerHTML = `
                <input type="file"
                       id="image-${num}"
                       accept="image/*"
                       style="display: none;"
                       onchange="handleImageUpload(${num}, this)">
                <div class="upload-content">
                    <div class="upload-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h6>Upload Image</h6>
                    <p class="text-muted small mb-0">Click to select image</p>
                </div>
            `;
        }
        triggerAutoSave();
    }
}

function updateQuestionElementIds(element, newNum) {
    const textarea = element.querySelector('textarea');
    if (textarea) {
        textarea.id = `question-${newNum}-content`;
        textarea.setAttribute('oninput', `updateQuestion(${newNum}, 'content', this.value)`);
    }
    
    const select = element.querySelector('select');
    if (select) {
        select.id = `question-${newNum}-type`;
        select.setAttribute('onchange', `toggleQuestionType(${newNum}, this.value)`);
    }
    
    const fileInput = element.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.id = `image-${newNum}`;
        fileInput.setAttribute('onchange', `handleImageUpload(${newNum}, this)`);
    }
    
    const uploadZone = element.querySelector('.image-upload-zone');
    if (uploadZone) {
        uploadZone.setAttribute('onclick', `document.getElementById('image-${newNum}').click()`);
    }
    
    const actionButtons = element.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        const icon = button.querySelector('i');
        if (icon) {
            if (icon.classList.contains('fa-arrow-up')) {
                button.setAttribute('onclick', `moveQuestion(${newNum}, 'up')`);
            } else if (icon.classList.contains('fa-arrow-down')) {
                button.setAttribute('onclick', `moveQuestion(${newNum}, 'down')`);
            } else if (icon.classList.contains('fa-copy')) {
                button.setAttribute('onclick', `duplicateQuestion(${newNum})`);
            } else if (icon.classList.contains('fa-trash')) {
                button.setAttribute('onclick', `deleteQuestion(${newNum})`);
            }
        }
    });
    
    const optionsContainer = element.querySelector('.answer-options');
    if (optionsContainer) {
        optionsContainer.id = `options-${newNum}`;
        
        const optionInputs = optionsContainer.querySelectorAll('input[type="text"]');
        optionInputs.forEach((input, index) => {
            const letter = String.fromCharCode(65 + index);
            input.id = `option-${newNum}-${letter}`;
            input.setAttribute('oninput', `updateQuestion(${newNum}, 'option${letter}', this.value)`);
        });
        
        const radioButtons = optionsContainer.querySelectorAll('.option-radio');
        radioButtons.forEach((radio, index) => {
            const letter = String.fromCharCode(65 + index);
            radio.id = `radio-${newNum}-${letter}`;
            radio.setAttribute('onclick', `selectCorrectAnswer(${newNum}, '${letter}')`);
        });
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        max-width: 350px;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    `;
    
    const colors = {
        success: 'linear-gradient(135deg, #10b981, #059669)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)',
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
        info: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
    };
    
    notification.style.background = colors[type] || colors.info;
    
    const icon = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="${icon[type] || icon.info} me-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function scrollToPreviewQuestion(num) {
    const element = document.getElementById(`previewQuestion${num}`);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

function selectPreviewOption(element, questionNum) {
    const parent = element.closest('.preview-options');
    if (parent) {
        // Remove selected state from all options
        parent.querySelectorAll('.preview-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected state to clicked option
        element.classList.add('selected');
        
        // Update navigation button state
        const navButton = document.querySelector(`#nav-btn-${questionNum}`);
        if (navButton) {
            navButton.classList.add('answered');
        }
        
        updatePreviewProgress();
    }
}

function resetPreviewState() {
    if (previewTimer) clearInterval(previewTimer);
    
    // Reset navigation buttons
    document.querySelectorAll('.preview-navigator-btn').forEach(btn => {
        btn.classList.remove('answered');
    });
    
    // Reset selected options
    document.querySelectorAll('.preview-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Reset progress bar
    const progressBar = document.getElementById('previewProgress');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
    }
}

function updatePreviewProgress() {
    const total = document.querySelectorAll('.preview-question').length;
    const answered = document.querySelectorAll('.preview-option.selected').length;
    const progress = total > 0 ? (answered / total) * 100 : 0;
    
    const progressBar = document.getElementById('previewProgress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
}
// Add notification animations
if (!document.querySelector('#notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .notification {
            transform: translateZ(0);
        }
    `;
    document.head.appendChild(style);
}

function deleteQuestion(num) {
    Swal.fire({
        title: 'Delete Question?',
        text: `Are you sure you want to delete Question ${num}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete Question',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: 'swal-modern'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const element = document.getElementById(`question-${num}`);
            if (element) {
                // Add exit animation
                element.style.animation = 'fadeOut 0.3s ease-out';
                
                setTimeout(() => {
                    element.remove();
                    questions = questions.filter(q => q.id !== num);
                    renumberQuestions();
                    updateQuestionCount();
                    triggerAutoSave();
                }, 300);
                
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Question has been deleted successfully.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    customClass: {
                        popup: 'swal-modern'
                    }
                });
            }
        }
    });
}

function startMockTimer() {
    if (previewTimer) clearInterval(previewTimer);
    
    let time = 45 * 60; // 45 minutes
    const timerEl = document.getElementById('previewTimer');
    
    previewTimer = setInterval(() => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        
        if (timerEl) {
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (--time < 0) {
            clearInterval(previewTimer);
            if (timerEl) {
                timerEl.textContent = '00:00';
            }
        }
    }, 1000);
}

// Export common functions
window.createQuestionHtml = createQuestionHtml;
window.createOptionsHtml = createOptionsHtml;
window.updateQuestion = updateQuestion;
window.selectCorrectAnswer = selectCorrectAnswer;
window.toggleQuestionType = toggleQuestionType;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.updateQuestionElementIds = updateQuestionElementIds;
window.showNotification = showNotification;
window.deleteQuestion = deleteQuestion;
window.setupAutoSave = setupAutoSave;
window.startMockTimer = startMockTimer;
window.toggleScheduleSettings = toggleScheduleSettings;
window.moveQuestion = moveQuestion;
window.renumberQuestions = renumberQuestions;
window.renderAllQuestions = renderAllQuestions;
window.triggerAutoSave = triggerAutoSave;
window.showAutoSaveIndicator = showAutoSaveIndicator;
window.updateQuestionCount = updateQuestionCount;
window.duplicateQuestion = duplicateQuestion;
window.setupAutoSave = setupAutoSave;
window.showNotification = showNotification;
window.scrollToPreviewQuestion = scrollToPreviewQuestion;
window.selectPreviewOption = selectPreviewOption;
window.updatePreviewProgress = updatePreviewProgress;
window.resetPreviewState = resetPreviewState;