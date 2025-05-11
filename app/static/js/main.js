document.addEventListener('DOMContentLoaded', function() {
    // Check if libraries are loaded
    if (typeof marked === 'undefined') {
        console.error('marked.js library is not loaded! Insights cannot be rendered properly.');
    } else {
        // Set marked options for better rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            highlight: function(code, lang) {
                return code;
            }
        });
    }
    
    // Check if D3.js is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js library is not loaded! Visualizations cannot be rendered properly.');
        showToast('Visualization library (D3.js) is not loaded. Visualizations will not work properly.', 'error');
    } else {
        console.log('D3.js library is loaded correctly. Version:', d3.version);
    }
    
    // Navigation
    const allNavItems = document.querySelectorAll('.sidebar-nav li');
    const sections = document.querySelectorAll('.content-section');
    
    // Add transition effect to sections
    sections.forEach(section => {
        section.style.transition = 'opacity 0.3s ease-in-out';
    });
    
    allNavItems.forEach(item => {
        item.addEventListener('click', function() {
            // Skip if the item is disabled
            if (this.classList.contains('disabled')) {
                showToast('Please upload data first to access this section');
                return;
            }
            
            const sectionId = this.getAttribute('data-section');
            
            // Update active nav item
            allNavItems.forEach(navItem => navItem.classList.remove('active'));
            this.classList.add('active');
            
            // Show selected section with fade effect
            sections.forEach(section => {
                section.style.opacity = '0';
                setTimeout(() => {
                    section.classList.remove('active');
                    if (section.id === sectionId) {
                        section.classList.add('active');
                        setTimeout(() => {
                            section.style.opacity = '1';
                        }, 50);
                    }
                }, 300);
            });
        });
    });
    
    // File Upload
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const dataPreview = document.getElementById('data-preview');
    let selectedFile = null;
    
    // Handle drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropzone.classList.add('dragover');
    }
    
    function unhighlight() {
        dropzone.classList.remove('dragover');
    }
    
    // Handle file selection
    dropzone.addEventListener('drop', handleDrop, false);
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
            handleFiles(files);
        }
    }
    
    function handleFileSelect(e) {
        const files = e.target.files;
        
        if (files.length) {
            handleFiles(files);
        }
    }
    
    function handleFiles(files) {
        selectedFile = files[0];
        uploadBtn.disabled = false;
        
        // Add animation to button
        uploadBtn.classList.add('ready');
        
        // Display selected file name
        const fileName = document.createElement('p');
        fileName.innerHTML = `<strong>Selected:</strong> ${selectedFile.name}`;
        fileName.classList.add('selected-file');
        
        // Remove previous selected file info if exists
        const previousFile = dropzone.querySelector('.selected-file');
        if (previousFile) {
            dropzone.removeChild(previousFile);
        }
        
        dropzone.appendChild(fileName);
        
        // Show a toast notification
        showToast(`File "${selectedFile.name}" selected. Click Upload to proceed.`);
    }
    
    // Handle file upload
    uploadBtn.addEventListener('click', uploadFile);
    
    // Function to upload file
    function uploadFile() {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        if (!file) {
            showError('Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Show loading indicator
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // Check if response is OK
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        // Try to parse as JSON if possible
                        const jsonError = JSON.parse(text);
                        throw new Error(jsonError.error || `Server error: ${response.status}`);
                    } catch (parseError) {
                        // If not valid JSON, use the text directly
                        throw new Error(`Server error: ${response.status} - ${text || 'Unknown error'}`);
                    }
                });
            }
            
            // Check content type
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                return response.text().then(text => {
                    throw new Error('Server returned an invalid response format');
                });
            }
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (!data.success) {
                throw new Error('Server did not indicate success in the response');
            }
            
            // Hide loading indicator and update button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload';
            
            // Show success message
            showToast('File uploaded successfully!', 'success');
            
            // Display data preview
            showDataPreview(data);
            
            // Show data preview section
            document.getElementById('data-preview').classList.remove('hidden');
            
            // Enable insights navigation
            enableNavigation();
        })
        .catch(error => {
            // Reset button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload';
            
            // Show error message
            showError(`Error uploading file: ${error.message}`);
        });
    }
    
    function showDataPreview(data) {
        // Show the data preview container
        dataPreview.classList.remove('hidden');
        
        // Check if data is the full response or just the summary
        // If it contains success and filename properties, it's the full response
        const summary = data.summary ? data.summary : data;
        
        // Set file info - get filename either from the full response or from the session
        const filename = data.filename || document.getElementById('file-input').files[0].name;
        document.getElementById('filename').textContent = filename;
        
        if (summary.type === 'dataframe') {
            document.getElementById('filetype').textContent = 'DataFrame';
            
            // Show data stats
            const statsHtml = `
                <p><strong>Rows:</strong> ${summary.rows}</p>
                <p><strong>Columns:</strong> ${summary.columns}</p>
                <p><strong>Column Names:</strong> ${summary.column_names.join(', ')}</p>
            `;
            
            document.getElementById('data-stats').innerHTML = statsHtml;
            
            // Create table preview
            createTablePreview(summary.sample, summary.column_names);
        } else {
            document.getElementById('filetype').textContent = 'JSON';
            
            // Show JSON preview
            document.getElementById('data-stats').innerHTML = '<p>JSON structure preview:</p>';
            
            const tableContainer = document.getElementById('preview-table-container');
            tableContainer.innerHTML = '<pre>' + summary.preview + '</pre>';
        }
    }
    
    function createTablePreview(data, columns) {
        const table = document.getElementById('preview-table');
        table.innerHTML = '';
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create data rows
        const tbody = document.createElement('tbody');
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            
            columns.forEach(column => {
                const td = document.createElement('td');
                td.textContent = row[column] !== null ? row[column] : 'N/A';
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
    }
    
    // Generate Insights
    const analyzeBtn = document.getElementById('analyze-btn');
    analyzeBtn.addEventListener('click', function() {
        console.log('Analyze button clicked');
        
        // Navigate to insights section using the global function
        navigateToSection('insights-section');
        
        // Generate default insights
        generateInsights();
    });
    
    function generateInsights(question = null) {
        const insightType = document.getElementById('insight-type').value;
        const loadingIndicator = document.getElementById('loading-indicator');
        const insightsDisplay = document.getElementById('insights-display');
        
        // Show loading indicator
        loadingIndicator.classList.remove('hidden');
        insightsDisplay.classList.add('hidden');
        
        // Prepare request data
        const requestData = {
            insight_type: insightType
        };
        
        if (question) {
            requestData.question = question;
        }
        
        // Send request to generate insights
        fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        // Try to parse as JSON if possible
                        const jsonError = JSON.parse(text);
                        throw new Error(jsonError.error || `Server error: ${response.status}`);
                    } catch (parseError) {
                        // If not valid JSON, use the text directly
                        throw new Error(`Server error: ${response.status} - ${text || 'Unknown error'}`);
                    }
                });
            }
            
            // Check content type
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                return response.text().then(text => {
                    throw new Error('Server returned an invalid response format');
                });
            }
        })
        .then(data => {
            // Hide loading indicator
            loadingIndicator.classList.add('hidden');
            insightsDisplay.classList.remove('hidden');
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // Display insights
            displayInsights(data.insights);
            
            // Generate visualizations
            generateVisualizations(data.visualizations);
        })
        .catch(error => {
            loadingIndicator.classList.add('hidden');
            insightsDisplay.classList.remove('hidden');
            showError('Error generating insights: ' + error.message);
        });
    }
    
    // Handle insight type change
    document.getElementById('insight-type').addEventListener('change', function() {
        generateInsights();
    });
    
    // Handle specific question
    document.getElementById('ask-btn').addEventListener('click', function() {
        const question = document.getElementById('specific-question').value.trim();
        
        if (question) {
            generateInsights(question);
        }
    });
    
    // Allow pressing Enter in the question input
    document.getElementById('specific-question').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const question = this.value.trim();
            
            if (question) {
                generateInsights(question);
            }
        }
    });
    
    function displayInsights(insights) {
        // Make sure insights element exists
        const insightsContent = document.getElementById('insights-content');
        if (!insightsContent) {
            return;
        }
        
        // Use marked.js to render markdown
        try {
            insightsContent.innerHTML = marked.parse(insights);
        } catch (error) {
            insightsContent.innerHTML = '<p class="error">Error rendering insights. Please try again.</p>';
        }
    }
    
    function generateVisualizations(visualizationsData) {
        const container = document.getElementById('visualizations-container');
        container.innerHTML = '';
        
        if (!visualizationsData || visualizationsData.length === 0) {
            container.innerHTML = '<p class="no-data">No visualizations available for this data.</p>';
            return;
        }
        
        visualizationsData.forEach((vizData, index) => {
            // Create visualization card
            const card = document.createElement('div');
            card.className = 'visualization-card';
            
            // Create card header
            const header = document.createElement('h3');
            header.textContent = vizData.title;
            card.appendChild(header);
            
            // Create visualization content container
            const content = document.createElement('div');
            content.className = 'visualization-content';
            content.id = `viz-${index}`;
            card.appendChild(content);
            
            // Add card to container
            container.appendChild(card);
            
            // Create visualization based on type
            try {
                createVisualization(vizData, content.id);
            } catch (error) {
                content.innerHTML = `<p class="error">Error creating visualization: ${error.message}</p>`;
            }
        });
    }
    
    function createVisualization(vizData, containerId) {
        // Check if container exists
        const containerElement = document.getElementById(containerId);
        if (!containerElement) {
            return;
        }
        
        // Check if D3 is available
        if (typeof d3 === 'undefined') {
            containerElement.innerHTML = '<p class="error">Visualization library not available</p>';
            return;
        }
        
        // Check if vizData has required properties
        if (!vizData || !vizData.type || !vizData.data || vizData.data.length === 0) {
            containerElement.innerHTML = '<p class="error">Invalid visualization data</p>';
            return;
        }
        
        const container = d3.select(`#${containerId}`);
        const width = containerElement.clientWidth || 400;
        const height = 300;
        
        // Clear any existing content
        container.html('');
        
        try {
            switch(vizData.type) {
                case 'histogram':
                    createHistogram(vizData, container, width, height);
                    break;
                case 'pie':
                    createPieChart(vizData, container, width, height);
                    break;
                case 'heatmap':
                    createHeatmap(vizData, container, width, height);
                    break;
                default:
                    container.html(`<p>Unsupported visualization type: ${vizData.type}</p>`);
            }
        } catch (error) {
            container.html(`<p class="error">Failed to create visualization: ${error.message}</p>`);
        }
    }
    
    function createHistogram(vizData, container, width, height) {
        // Clear container
        container.html('');
        
        // Define margins
        const margin = {top: 20, right: 30, bottom: 60, left: 40};
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Define scales
        const xScale = d3.scaleBand()
            .domain(vizData.data.map(d => d[vizData.x_field]))
            .range([0, innerWidth])
            .padding(0.1);
        
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(vizData.data, d => d[vizData.y_field])])
            .nice()
            .range([innerHeight, 0]);
        
        // Create bars
        g.selectAll('.bar')
            .data(vizData.data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d[vizData.x_field]))
            .attr('y', d => yScale(d[vizData.y_field]))
            .attr('width', xScale.bandwidth())
            .attr('height', d => innerHeight - yScale(d[vizData.y_field]))
            .attr('fill', '#4361ee');
        
        // Add axes
        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');
        
        g.append('g')
            .call(d3.axisLeft(yScale));
        
        // Add axis labels
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', height - 5)
            .text(vizData.x_field);
        
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .text(vizData.y_field);
    }
    
    function createPieChart(vizData, container, width, height) {
        // Clear container
        container.html('');
        
        // Define dimensions
        const radius = Math.min(width, height) / 2.5;
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);
        
        // Define color scale
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        
        // Create pie generator
        const pie = d3.pie()
            .value(d => d[vizData.value_field])
            .sort(null);
        
        // Create arc generator
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);
        
        // Create outer arc for labels
        const outerArc = d3.arc()
            .innerRadius(radius * 1.1)
            .outerRadius(radius * 1.1);
        
        // Generate pie slices
        const arcs = g.selectAll('.arc')
            .data(pie(vizData.data))
            .enter().append('g')
            .attr('class', 'arc');
        
        // Add colored pie segments
        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => color(i))
            .attr('stroke', 'white')
            .style('stroke-width', '2px');
        
        // Add labels
        const text = arcs.append('text')
            .attr('transform', d => {
                const pos = outerArc.centroid(d);
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                pos[0] = radius * 0.8 * (midAngle < Math.PI ? 1 : -1);
                return `translate(${pos})`;
            })
            .attr('dy', '.35em')
            .attr('text-anchor', d => {
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                return midAngle < Math.PI ? 'start' : 'end';
            });
        
        // Add category text
        text.append('tspan')
            .text(d => {
                const category = d.data[vizData.category_field].toString();
                return category.length > 12 ? category.substring(0, 10) + '...' : category;
            })
            .attr('x', 0)
            .attr('dy', '0em');
        
        // Add percentage text
        text.append('tspan')
            .text(d => {
                const total = d3.sum(vizData.data, item => item[vizData.value_field]);
                const percent = (d.data[vizData.value_field] / total * 100).toFixed(1);
                return `${percent}%`;
            })
            .attr('x', 0)
            .attr('dy', '1.2em');
        
        // Add polylines between pie and labels
        arcs.append('polyline')
            .attr('points', d => {
                const pos = outerArc.centroid(d);
                const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                pos[0] = radius * 0.75 * (midAngle < Math.PI ? 1 : -1);
                return [arc.centroid(d), outerArc.centroid(d), pos];
            })
            .style('fill', 'none')
            .style('stroke', 'gray')
            .style('stroke-width', '1px');
    }
    
    function createHeatmap(vizData, container, width, height) {
        // Clear container
        container.html('');
        
        // Define margins
        const margin = {top: 40, right: 25, bottom: 60, left: 60};
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Get unique x and y values
        const xValues = [...new Set(vizData.data.map(d => d[vizData.x_field]))];
        const yValues = [...new Set(vizData.data.map(d => d[vizData.y_field]))];
        
        // Define scales
        const xScale = d3.scaleBand()
            .domain(xValues)
            .range([0, innerWidth])
            .padding(0.05);
        
        const yScale = d3.scaleBand()
            .domain(yValues)
            .range([0, innerHeight])
            .padding(0.05);
        
        // Color scale for heatmap
        const colorScale = d3.scaleSequential(d3.interpolateRdBu)
            .domain([1, -1]);  // Note: reversed for correlation matrix
        
        // Create heatmap cells
        g.selectAll('rect')
            .data(vizData.data)
            .enter().append('rect')
            .attr('x', d => xScale(d[vizData.x_field]))
            .attr('y', d => yScale(d[vizData.y_field]))
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', d => colorScale(d[vizData.value_field]))
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
        
        // Add cell values
        g.selectAll('text')
            .data(vizData.data)
            .enter().append('text')
            .attr('x', d => xScale(d[vizData.x_field]) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d[vizData.y_field]) + yScale.bandwidth() / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', d => Math.abs(d[vizData.value_field]) > 0.5 ? 'white' : 'black')
            .text(d => d[vizData.value_field].toFixed(2));
        
        // Add axes
        g.append('g')
            .attr('transform', `translate(0,0)`)
            .call(d3.axisTop(xScale))
            .selectAll('text')
            .style('text-anchor', 'start')
            .attr('dx', '0.5em')
            .attr('dy', '0.5em')
            .attr('transform', 'rotate(-45)');
        
        g.append('g')
            .call(d3.axisLeft(yScale));
        
        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .text(vizData.title);
    }
    
    // Function to show error messages
    function showError(message) {
        showToast(message, 'error');
    }
    
    // Function for toast notifications
    function showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
            `;
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        
        // Set styles based on type
        let bgColor = '#4361ee';
        let icon = 'info-circle';
        
        switch(type) {
            case 'error':
                bgColor = '#f44336';
                icon = 'exclamation-circle';
                break;
            case 'success':
                bgColor = '#4caf50';
                icon = 'check-circle';
                break;
            case 'warning':
                bgColor = '#ff9800';
                icon = 'exclamation-triangle';
                break;
        }
        
        toast.style.cssText = `
            background-color: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            animation: slideIn 0.3s, fadeOut 0.5s 3.5s forwards;
            max-width: 350px;
            opacity: 0;
        `;
        
        toast.innerHTML = `
            <i class="fas fa-${icon}" style="margin-right: 10px;"></i>
            <span>${message}</span>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
            }, 500);
        }, 4000);
    }
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .hidden {
            display: none;
        }
        
        .primary-btn.ready {
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(67, 97, 238, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(67, 97, 238, 0); }
            100% { box-shadow: 0 0 0 0 rgba(67, 97, 238, 0); }
        }
    `;
    document.head.appendChild(style);
    
    // Function to enable navigation after file upload
    function enableNavigation() {
        // Enable all navigation items in the sidebar
        const disabledItems = document.querySelectorAll('.sidebar-nav li.disabled');
        
        disabledItems.forEach(item => {
            item.classList.remove('disabled');
        });
        
        // Enable analyze button
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }
    }

    // Function to navigate to a specific section
    function navigateToSection(sectionId) {
        // Find the nav item
        const navItem = document.querySelector(`.sidebar-nav li[data-section="${sectionId}"]`);
        
        if (navItem) {
            // Remove disabled class if present
            navItem.classList.remove('disabled');
            
            // Click the nav item to trigger navigation
            navItem.click();
        } else {
            // Direct navigation as fallback
            const allNavItems = document.querySelectorAll('.sidebar-nav li');
            allNavItems.forEach(item => item.classList.remove('active'));
            
            const sections = document.querySelectorAll('.content-section');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
        }
    }

    // Make the function globally accessible for onclick handlers
    window.navigateToSection = navigateToSection;
    
    // Make toast function global for debugging
    window.showToast = showToast;

    // Add event listener for sample data button
    const sampleDataBtn = document.getElementById('sample-data-btn');
    sampleDataBtn.addEventListener('click', loadSampleData);

    function loadSampleData() {
        // Show loading state
        sampleDataBtn.disabled = true;
        sampleDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        // Request sample data from server
        fetch('/sample_data', {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Reset button state
            sampleDataBtn.disabled = false;
            sampleDataBtn.innerHTML = '<i class="fas fa-vial"></i> Try with Sample Data';
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Show success message
            showToast('Sample data loaded successfully!', 'success');
            
            // Display data preview
            showDataPreview(data);
            
            // Show data preview section
            document.getElementById('data-preview').classList.remove('hidden');
            
            // Enable insights navigation
            enableNavigation();
        })
        .catch(error => {
            // Reset button state
            sampleDataBtn.disabled = false;
            sampleDataBtn.innerHTML = '<i class="fas fa-vial"></i> Try with Sample Data';
            
            // Show error message
            showError(`Error loading sample data: ${error.message}`);
        });
    }
}); 