document.addEventListener("DOMContentLoaded", () => {
    // Navbar Scroll Effect
    const navbar = document.getElementById("navbar");
    const logoImg = document.querySelector(".logo img");
    const missionSection = document.getElementById("mission");
    
    window.addEventListener("scroll", () => {
        let threshold = 50;

        // On the portfolio detail page, wait until the hero section is scrolled past
        const detailHero = document.querySelector('.detail-hero');
        if (detailHero) {
            // Subtract navbar height so it triggers exactly when the white background reaches the top of the screen/navbar
            threshold = detailHero.offsetHeight - navbar.offsetHeight;
        }

        if (window.scrollY > threshold) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // Nav link click feedback (adds .clicked for 400ms)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function() {
            this.classList.add('clicked');
            setTimeout(() => this.classList.remove('clicked'), 400);
        });
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Fade-in elements
    const animatedElements = document.querySelectorAll('.fade-in-up, .stagger-up');
    animatedElements.forEach(el => observer.observe(el));

    // --- Mystical Portfolio Logic ---
    const projects = [
        {
            title: "<div style=\"font-family: 'Playfair Display', 'Cormorant', serif; line-height: 1.1;\">Love's Last Letter</div><div style='font-family: \"Inter\", sans-serif; font-size: 0.45em; font-weight: 400; color: #666; letter-spacing: 0.5px; margin-top: 0.2rem;'>An immersive archive of love, memory, and voice.</div>",
            img: "assets/포폴사랑의 유서 썸네일.mov",
            url: "loves-last-letter.html",
            desc: "<div style='font-family: \"Inter\", sans-serif; display: flex; flex-direction: column; gap: 2rem; padding-top: 0.5rem;'><p style='font-family: \"Playfair Display\", \"Cormorant\", serif; font-size: 1.45rem; font-weight: 400; line-height: 1.4; color: #1a1a1a; letter-spacing: -0.5px;'>An Immersive Exhibition<br><span style='font-family: \"Inter\", sans-serif; font-weight: 300; font-size: 1.35rem;'>&</span> Vocal Performance</p><p style='font-size: 1.15rem; line-height: 1.8; color: #444; font-weight: 300;'>Exploring the multifaceted layers of love from nature and family to our cherished companions.</p><p style='font-family: \"Caveat\", cursive; font-size: 1.8rem; font-weight: 600; color: #ab724b; line-height: 1.4; padding-left: 1rem; border-left: 3px solid #ab724b; letter-spacing: 0.5px;'>A final opportunity to say “I’m sorry,” “Thank you,” and “I love you.”</p></div>"
        },
        {
            title: "Project 2: Light Pulse",
            img: "assets/portfolio_sculpture.png",
            desc: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident."
        },
        {
            title: "Project 3: Canopy Connection",
            img: "assets/portfolio_digital_art.png",
            desc: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis."
        },
        {
            title: "Project 4: Floral Flow",
            img: "assets/portfolio_sculpture.png",
            desc: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt."
        }
    ];

    let currentIndex = 0;
    const cardEl = document.getElementById("project-card");
    const titleEl = document.getElementById("proj-title");
    const imgEl = document.getElementById("proj-img");
    const videoEl = document.getElementById("proj-video");
    const textEl = document.getElementById("proj-text");
    const thumbList = document.getElementById("thumbnail-list");
    const beamPath = document.getElementById("beam-path");
    const mainFrame = document.getElementById("main-frame");

    // Initialize Thumbnails
    if (thumbList) {
        projects.forEach((proj, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "thumbnail-item";
            
            if (proj.img.endsWith('.mov') || proj.img.endsWith('.mp4')) {
                const vid = document.createElement('video');
                vid.src = proj.img;
                vid.autoplay = true;
                vid.muted = true;
                vid.loop = true;
                vid.playsInline = true;
                vid.style.width = '100%';
                vid.style.height = '100%';
                vid.style.objectFit = 'contain';
                vid.style.pointerEvents = 'none';
                
                vid.addEventListener('timeupdate', function() {
                    // Loop naturally without black screen
                    if (this.duration && this.currentTime >= this.duration - 0.15) {
                        this.currentTime = 0;
                        this.play();
                    }
                });
                
                thumb.appendChild(vid);
            } else {
                thumb.style.backgroundImage = `url('${proj.img}')`;
            }
            
            if (idx === 0) thumb.classList.add("active");
            
            thumb.addEventListener("click", () => {
                if (currentIndex !== idx) {
                    currentIndex = idx;
                    updateSlider();
                }
                fireBeam(thumb);
            });

            thumb.addEventListener("mouseenter", () => {
                fireBeam(thumb);
            });

            thumbList.appendChild(thumb);
        });
    }

    const contentEl = document.querySelector(".card-content");

    function updateSlider() {
        if (!contentEl) return;
        
        // Update content instantly without animations
        const proj = projects[currentIndex];
        titleEl.innerHTML = proj.title;
        
        if (proj.img.endsWith('.mov') || proj.img.endsWith('.mp4')) {
            imgEl.style.display = 'none';
            videoEl.src = proj.img;
            videoEl.style.display = 'block';
            
            // Loop naturally without black screen for main video
            videoEl.ontimeupdate = function() {
                if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.15) {
                    videoEl.currentTime = 0;
                    videoEl.play();
                }
            };
        } else {
            videoEl.style.display = 'none';
            videoEl.ontimeupdate = null;
            imgEl.src = proj.img;
            imgEl.style.display = 'block';
        }
        
        textEl.innerHTML = proj.desc;
        
        // Update active thumbnail
        document.querySelectorAll(".thumbnail-item").forEach((thumb, idx) => {
            thumb.classList.toggle("active", idx === currentIndex);
        });
    }

    // Call it initially to sync the UI with the first project
    updateSlider();

    const prevBtn = document.querySelector(".prev-btn");
    const nextBtn = document.querySelector(".next-btn");

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener("click", () => {
            currentIndex = (currentIndex - 1 + projects.length) % projects.length;
            updateSlider();
        });
        
        nextBtn.addEventListener("click", () => {
            currentIndex = (currentIndex + 1) % projects.length;
            updateSlider();
        });
    }

    // Light Beam Logic
    let beamTimeout;
    function fireBeam(thumbnailEl) {
        if (!beamPath || !mainFrame) return;

        const thumbRect = thumbnailEl.getBoundingClientRect();
        const frameRect = mainFrame.getBoundingClientRect();
        
        // Ensure relative to viewport/document nicely via bounding rects
        const svgRect = beamPath.ownerSVGElement.getBoundingClientRect();

        // Calculate coordinates relative to SVG canvas
        const startX = thumbRect.left + thumbRect.width / 2 - svgRect.left;
        const startY = thumbRect.top - svgRect.top; // Top center of thumbnail
        
        const endX = frameRect.left + frameRect.width / 2 - svgRect.left;
        const endY = frameRect.bottom - 20 - svgRect.top; // Bottom center of the mystical frame
        
        // Control point for quadratic curve to make an electric/curved beam
        const cpX = (startX + endX) / 2 + (Math.random() * 100 - 50);
        const cpY = startY - (startY - endY) / 2;

        const pathData = `M ${startX},${startY} Q ${cpX},${cpY} ${endX},${endY}`;
        beamPath.setAttribute("d", pathData);
        
        // Trigger animation
        beamPath.classList.remove("active");
        void beamPath.offsetWidth; // Trigger reflow
        beamPath.classList.add("active");

        // Cleanup after animation
        clearTimeout(beamTimeout);
        beamTimeout = setTimeout(() => {
            beamPath.classList.remove("active");
        }, 600);
    }

    // --- Cinematic Background Logic ---
    const bgHero = document.getElementById('bg-hero');
    const bgMission = document.getElementById('bg-mission');
    const bgPortfolio = document.getElementById('bg-portfolio');
    const bgNews = document.getElementById('bg-news');
    const bgContact = document.getElementById('bg-contact-wrapper');
    
    const heroSec = document.getElementById('hero');
    const missionSec = document.getElementById('mission');
    const portfolioSec = document.getElementById('portfolio');
    const newsSec = document.getElementById('news');
    const contactSec = document.getElementById('contact');

    // Canvas Setup
    const canvas = document.getElementById('particle-canvas');
    let ctx, width, height, particles = [], scrollRatio = 0;
    if(canvas) {
        ctx = canvas.getContext('2d');
        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // Conservative Particle Array (increased slightly to 85 per user request)
        for(let i=0; i<85; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                baseSize: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: (Math.random() - 0.5) * 0.4 - 0.2, 
                life: Math.random() * Math.PI * 2,
                offset: Math.random() * Math.PI * 2
            });
        }
    }

    window.addEventListener('scroll', () => {
        if(!heroSec || !missionSec || !portfolioSec) return;
        
        const heroRect = heroSec.getBoundingClientRect();
        const missionRect = missionSec.getBoundingClientRect();
        const portfolioRect = portfolioSec.getBoundingClientRect();
        const newsRect = newsSec ? newsSec.getBoundingClientRect() : null;
        const contactRect = contactSec ? contactSec.getBoundingClientRect() : null;
        
        // Decoupled logic: FadeIn handles cinematic stacking to prevent base-layer dips.
        // Coverage handles precise particle system visibility.
        
        const getFadeIn = (rect) => {
            if (!rect) return 0;
            const totalH = window.innerHeight;
            if (rect.top <= 0) return 1;           // Scrolled past top
            if (rect.top >= totalH) return 0;      // Not yet reached
            return 1 - (rect.top / totalH);        // Fading in
        };

        const getCoverage = (rect) => {
            if (!rect) return 0;
            const totalH = window.innerHeight;
            if (rect.bottom < 0 || rect.top > totalH) return 0;
            let visibleHeight = Math.min(rect.bottom, totalH) - Math.max(rect.top, 0);
            return Math.max(0, Math.min(1, visibleHeight / totalH));
        };

        // Stacked crossfade: Bottom layers stay 1, preventing the lowest video from showing through
        if(bgMission) bgMission.style.opacity = getFadeIn(missionRect);
        if(bgPortfolio) bgPortfolio.style.opacity = getFadeIn(portfolioRect);
        if(bgNews) bgNews.style.opacity = getFadeIn(newsRect);
        if(bgContact) bgContact.style.opacity = getFadeIn(contactRect);

        let heroCov = getCoverage(heroRect);
        let missionCov = getCoverage(missionRect);
        let portCov = getCoverage(portfolioRect);
        let newsCov = getCoverage(newsRect);
        let contactCov = getCoverage(contactRect);

        if(canvas) {
            // Show particles only on Mission and Portfolio. Hide on Hero, News, and Contact.
            if (heroCov > 0.6 || newsCov > 0.3 || contactCov > 0.1) {
                canvas.style.opacity = 0;
            } else {
                canvas.style.opacity = 1;
            }

            // Ratio of Mission relative to Forest
            let phase = missionCov / (Math.max(heroCov, portCov) + missionCov || 1);
            scrollRatio = isNaN(phase) ? 0 : phase;
        }
    });

    if(canvas) {
        function animate() {
            ctx.clearRect(0, 0, width, height);

            const r = Math.floor(255 * (1 - scrollRatio) + 0 * scrollRatio);
            const g = Math.floor(215 * (1 - scrollRatio) + 255 * scrollRatio);
            const b = Math.floor(0 * (1 - scrollRatio) + 255 * scrollRatio);

            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX + Math.sin(p.life * 2 + p.offset) * 0.3;
                p.life += 0.01;

                const blinkFreq = 1 + scrollRatio * 15; 
                const alpha = Math.abs(Math.sin(p.life * blinkFreq)) * 0.7 + 0.15; 
                const size = p.baseSize * (1 - scrollRatio * 0.5);

                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.1, size), 0, Math.PI * 2);
                
                ctx.shadowBlur = 10 * (1 - scrollRatio) + 2 * scrollRatio;
                ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                ctx.fill();

                if (p.y < -20) p.y = height + 20;
                if (p.y > height + 20) p.y = -20;
                if (p.x < -20) p.x = width + 20;
                if (p.x > width + 20) p.x = -20;
            });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // --- Portfolio Modal Logic ---
    const learnBtn = document.querySelector('.btn-learn');
    const modal = document.getElementById('portfolio-modal');
    const modalClose = document.getElementById('modal-close');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalImg = document.getElementById('modal-img');
    const modalVideo = document.getElementById('modal-video');
    const modalDesc = document.getElementById('modal-desc');

    if (learnBtn && modal) {
        learnBtn.addEventListener('click', () => {
            const proj = projects[currentIndex];
            
            // If project has a specific URL, open it in a new tab instead of showing the modal
            if (proj.url) {
                window.open(proj.url, '_blank');
                return;
            }
            
            // Update modal content to match selected project
            if (proj.img.endsWith('.mov') || proj.img.endsWith('.mp4')) {
                modalImg.style.display = 'none';
                modalVideo.src = proj.img;
                modalVideo.style.display = 'block';
                
                // Loop naturally without black screen for modal video
                modalVideo.ontimeupdate = function() {
                    if (modalVideo.duration && modalVideo.currentTime >= modalVideo.duration - 0.15) {
                        modalVideo.currentTime = 0;
                        modalVideo.play();
                    }
                };
            } else {
                modalVideo.style.display = 'none';
                modalVideo.ontimeupdate = null;
                modalImg.src = proj.img;
                modalImg.style.display = 'block';
            }
            modalDesc.innerHTML = "<strong>Artist's Note:</strong><br><br>" + proj.desc;
            
            modal.style.display = 'flex';
            // Slight delay to trigger CSS fade-in & scale-up
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
            
            // Prevent background scrolling
            document.body.style.overflow = 'hidden';
        });

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }, 500); // Matches CSS 0.5s transition
        };

        modalClose.addEventListener('click', closeModal);
        modalBackdrop.addEventListener('click', closeModal);
    }

    setTimeout(() => window.dispatchEvent(new Event('scroll')), 100);

    // --- Accordion Logic ---
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', function() {
            // Close other accordions if needed, but currently allowing multiple
            const item = this.parentElement;
            item.classList.toggle('active');
        });
    });

    // --- Team Modal Logic ---
    const teamData = {
        member1: {
            name: "Alex",
            role: "Founder & Creative Director",
            img: "assets/portfolio_digital_art.png",
            story: "Alex has always believed that art is a mirror reflecting our inner light. With a background in digital arts and mindfulness, they founded B-GLOW to create spaces where people can discover themselves through immersive experiences."
        },
        member2: {
            name: "Sam",
            role: "Head of Operations & Wellness",
            img: "assets/news_editorial.png",
            story: "Sam brings a unique blend of operational excellence and wellness practices to B-GLOW. Their journey started in clinical psychology before pivoting to experiential art therapy, ensuring every project deeply resonates with the audience."
        }
    };

    const teamCircles = document.querySelectorAll('.team-circle');
    const teamModal = document.getElementById('team-modal');
    const teamModalClose = document.getElementById('team-modal-close');
    const teamModalBackdrop = document.getElementById('team-modal-backdrop');
    
    const teamModalImg = document.getElementById('team-modal-img');
    const teamModalName = document.getElementById('team-modal-name');
    const teamModalRole = document.getElementById('team-modal-role');
    const teamModalStory = document.getElementById('team-modal-story');

    if (teamCircles && teamModal) {
        teamCircles.forEach(circle => {
            circle.addEventListener('click', () => {
                const memberKey = circle.getAttribute('data-team');
                const member = teamData[memberKey];
                
                if (member) {
                    teamModalImg.src = member.img;
                    teamModalName.textContent = member.name;
                    teamModalRole.textContent = member.role;
                    teamModalStory.textContent = member.story;
                }

                teamModal.style.display = 'flex';
                setTimeout(() => {
                    teamModal.classList.add('active');
                }, 10);
                document.body.style.overflow = 'hidden';
            });
        });

        const closeTeamModal = () => {
            teamModal.classList.remove('active');
            setTimeout(() => {
                teamModal.style.display = 'none';
                document.body.style.overflow = '';
            }, 400); // match transition duration
        };

        if (teamModalClose) teamModalClose.addEventListener('click', closeTeamModal);
        if (teamModalBackdrop) teamModalBackdrop.addEventListener('click', closeTeamModal);
    }
});
