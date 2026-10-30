<?php
class Baseweb extends CI_Controller
{

    function __construct()
    {
        parent::__construct();
        $this->load->model('Baseweb_model', 'Baseweb');
    }

    public function index()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));
        $statistik = array(
            'tahun' => $tahun,
            'bulan' => $bulan,
            'hari' => $hari
        );
        $this->Baseweb->PostStatistik($statistik);

        $data['pengumuman'] = $this->Baseweb->getPengumuman();
        $data['berita'] = $this->Baseweb->getBerita();
        $data['bannerUtama'] = $this->Baseweb->GetBannerUtama()->row_array();
        $data['bannerkedua'] = $this->Baseweb->GetBannerKedua()->result();
        $data['galeri'] = $this->Baseweb->getGaleri()->result();

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/utama', $data);
    }

    function login_admin()
    {
        $this->load->view('website/login');
    }

    public function literasi()
    {
        $this->load->view('literasi/login');
    }

    function checklog()
    {
        $username   = $this->input->post('username');
        $password   = $this->input->post('password', true);


        $users       = $this->Baseweb->AmbilUser($username);

        if ($users->num_rows() > 0) {
            $user = $users->row_array();
            //$this->db->where('password',  $test);
            if (password_verify($password, $user['password'])) {
                // retrive user data to session
                $this->session->set_userdata($user);
                // $this->session->set_flashdata('status_login', 'Username atau password yang anda input salah');
                redirect(site_url('Literasi'));
            } else {
                // $output['error'] = true;
                // $output['message'] = 'Password yang anda input salah';
                $this->session->set_flashdata('status_login', 'Password yang anda input salah');
                // echo json_encode($output);
                redirect('Baseweb/literasi');
            }
        } else {
            $this->session->set_flashdata('status_login', 'Username atau password yang anda input salah');
            redirect('Baseweb/literasi');
        }
    }

    function checklog_admin()
    {
        $username   = $this->input->post('username');
        $password   = $this->input->post('password', true);


        $admin       = $this->Baseweb->AmbilAdmin($username);

        if ($admin->num_rows() > 0) {
            $user = $admin->row_array();
            //$this->db->where('password',  $test);
            if (password_verify($password, $user['password'])) {
                // retrive user data to session
                $this->session->set_userdata($user);
                // $this->session->set_flashdata('status_login', 'Username atau password yang anda input salah');
                redirect(site_url('Administrator'));
            } else {
                $this->session->set_flashdata('status_login', 'Password yang anda input salah');
                // echo json_encode($output);
                redirect('Baseweb/login_admin');
            }
        } else {
            $this->session->set_flashdata('status_login', 'Username atau password yang anda input salah');
            redirect('Baseweb/login_admin');
        }
    }

    function daftar()
    {
        $this->load->view('website/daftar');
    }

    function postRegis()
    {
        $nama_user = $this->input->post('nama_user');
        $username = $this->input->post('username');
        $password = $this->input->post('password');
        $retry = $this->input->post('retry');
        $cekUser = $this->Baseweb->getUsername($username);
        if ($cekUser > 0) {
            $this->session->set_flashdata('status_login', 'Username sudah ada');
            redirect('Baseweb/daftar');
        } else {
            if ($password == $retry) {
                $hashPass = $hashPass = password_hash($password, PASSWORD_DEFAULT);
                $data = array(
                    'nama_user' => $nama_user,
                    'username' => $username,
                    'password' => $hashPass,
                    'log_user' => 1
                );
                $this->Baseweb->PostUser($data);
                redirect('Baseweb/literasi');
            } else {
                $this->session->set_flashdata('status_login', 'Password tidak sama, silahkan ulangi');
                redirect('Baseweb/daftar');
            }
        }
    }

    function berita()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $q = urldecode($this->input->get('q', TRUE));
        $start = intval($this->input->get('start'));

        if ($q <> '') {
            $config['base_url'] = base_url() . 'index.php/Baseweb/berita?q=' . urlencode($q);
            $config['first_url'] = base_url() . 'index.php/Baseweb/berita?q=' . urlencode($q);
        } else {
            $config['base_url'] = base_url() . 'index.php/Baseweb/berita';
            $config['first_url'] = base_url() . 'index.php/Baseweb/berita';
        }

        $config['per_page'] = 5;
        $config['page_query_string'] = TRUE;
        $config['total_rows'] = $this->Baseweb->total_rows($q);
        $berita = $this->Baseweb->get_limit_data($config['per_page'], $start, $q);
        $config['full_tag_open'] = '<ul class="pagination" role="navigation">';
        $config['full_tag_close'] = '</ul>';
        $config['first_link'] = 'Awal';
        $config['first_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['first_tag_close'] = '</span></li>';
        $config['last_link'] = 'Akhir';
        $config['last_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['last_tag_close'] = '</span></li>';
        $config['next_link'] = '&raquo;';
        $config['next_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['next_tag_close'] = '</span></li>';
        $config['prev_link'] = '&laquo;';
        $config['prev_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['prev_tag_close'] = '</span></li>';
        $config['cur_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['cur_tag_close'] = '</span></li>';
        $config['num_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['num_tag_close'] = '</span></li>';
        $this->load->library('pagination');
        $this->pagination->initialize($config);

        $data = array(
            'berita' => $berita,
            'q' => $q,
            'pagination' => $this->pagination->create_links(),
            'total_rows' => $config['total_rows'],
            'start' => $start,
        );
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_berita', $data);
    }

    function baca_berita($id)
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $dataBerita =  $this->Baseweb->AmbilBerita($id);
        $jumViewer = $dataBerita['viewer'] + 1;
        $tambah_viewer = array(
            'viewer' => $jumViewer
        );
        $this->Baseweb->PutBerita($id, $tambah_viewer);
        $data['berita']         = $dataBerita;
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['total'] = $this->Baseweb->getTotal();

        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_baca_berita', $data);
    }

    function pengumuman()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));
        $q = urldecode($this->input->get('q', TRUE));
        $start = intval($this->input->get('start'));

        if ($q <> '') {
            $config['base_url'] = base_url() . 'index.php/Baseweb/pengumuman?q=' . urlencode($q);
            $config['first_url'] = base_url() . 'index.php/Baseweb/pengumuman?q=' . urlencode($q);
        } else {
            $config['base_url'] = base_url() . 'index.php/Baseweb/pengumuman';
            $config['first_url'] = base_url() . 'index.php/Baseweb/pengumuman';
        }

        $config['per_page'] = 5;
        $config['page_query_string'] = TRUE;
        $config['total_rows'] = $this->Baseweb->total_rows_pengumuman($q);
        $pengumuman = $this->Baseweb->get_limit_data_pengumuman($config['per_page'], $start, $q);
        $config['full_tag_open'] = '<ul class="pagination" role="navigation">';
        $config['full_tag_close'] = '</ul>';
        $config['first_link'] = 'Awal';
        $config['first_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['first_tag_close'] = '</span></li>';
        $config['last_link'] = 'Akhir';
        $config['last_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['last_tag_close'] = '</span></li>';
        $config['next_link'] = '&raquo;';
        $config['next_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['next_tag_close'] = '</span></li>';
        $config['prev_link'] = '&laquo;';
        $config['prev_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['prev_tag_close'] = '</span></li>';
        $config['cur_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['cur_tag_close'] = '</span></li>';
        $config['num_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['num_tag_close'] = '</span></li>';
        $this->load->library('pagination');
        $this->pagination->initialize($config);

        $data = array(
            'pengumuman' => $pengumuman,
            'q' => $q,
            'pagination' => $this->pagination->create_links(),
            'total_rows' => $config['total_rows'],
            'start' => $start,
        );
        $data['pengumuman_terbaru'] = $this->Baseweb->getPengumumanTerbaru();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_pengumuman', $data);
    }

    function baca_pengumuman($id)
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $dataPengumuman =  $this->Baseweb->AmbilPengumuman($id);
        $jumViewer = $dataPengumuman['viewer'] + 1;
        $tambah_viewer = array(
            'viewer' => $jumViewer
        );
        $this->Baseweb->PutPengumuman($id, $tambah_viewer);
        $data['pengumuman_terbaru'] = $this->Baseweb->getPengumumanTerbaru();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['pengumuman'] = $dataPengumuman;

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_baca_pengumuman', $data);
    }

    public function tips_siaga_bencana()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $q = urldecode($this->input->get('q', TRUE));
        $start = intval($this->input->get('start'));

        if ($q <> '') {
            $config['base_url'] = base_url() . 'index.php/Baseweb/tips_siaga_bencana?q=' . urlencode($q);
            $config['first_url'] = base_url() . 'index.php/Baseweb/tips_siaga_bencana?q=' . urlencode($q);
        } else {
            $config['base_url'] = base_url() . 'index.php/Baseweb/tips_siaga_bencana';
            $config['first_url'] = base_url() . 'index.php/Baseweb/tips_siaga_bencana';
        }

        $config['per_page'] = 5;
        $config['page_query_string'] = TRUE;
        $config['total_rows'] = $this->Baseweb->total_rows_tips_siaga($q);
        $tips_bencana = $this->Baseweb->get_limit_data_tips_siaga($config['per_page'], $start, $q);
        $config['full_tag_open'] = '<ul class="pagination" role="navigation">';
        $config['full_tag_close'] = '</ul>';
        $config['first_link'] = 'Awal';
        $config['first_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['first_tag_close'] = '</span></li>';
        $config['last_link'] = 'Akhir';
        $config['last_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['last_tag_close'] = '</span></li>';
        $config['next_link'] = '&raquo;';
        $config['next_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['next_tag_close'] = '</span></li>';
        $config['prev_link'] = '&laquo;';
        $config['prev_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['prev_tag_close'] = '</span></li>';
        $config['cur_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['cur_tag_close'] = '</span></li>';
        $config['num_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['num_tag_close'] = '</span></li>';
        $this->load->library('pagination');
        $this->pagination->initialize($config);

        $data = array(
            'tips_bencana' => $tips_bencana,
            'q' => $q,
            'pagination' => $this->pagination->create_links(),
            'total_rows' => $config['total_rows'],
            'start' => $start,
        );
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_tips_bencana', $data);
    }

    function baca_tips_bencana($id)
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $dataTipsBencana =  $this->Baseweb->AmbilTipsBencana($id);
        if (empty($dataTipsBencana)) {
            redirect('Baseweb/tips_siaga_bencana');
        } else {
            $jumViewer = $dataTipsBencana['viewer'] + 1;
            $tambah_viewer = array(
                'viewer' => $jumViewer
            );
            $this->Baseweb->PutTipsBencana($id, $tambah_viewer);
            $data['tips_bencana']         = $dataTipsBencana;
            $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
            $data['berita_terbaru'] = $this->Baseweb->getBerita();

            $data['total'] = $this->Baseweb->getTotal();
            $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
            $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
            $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

            $this->template->load('template_website', 'website/content_baca_tips_bencana', $data);
        }
    }
    public function info_pelatihan()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $q = urldecode($this->input->get('q', TRUE));
        $start = intval($this->input->get('start'));

        if ($q <> '') {
            $config['base_url'] = base_url() . 'index.php/Baseweb/info_pelatihan?q=' . urlencode($q);
            $config['first_url'] = base_url() . 'index.php/Baseweb/info_pelatihan?q=' . urlencode($q);
        } else {
            $config['base_url'] = base_url() . 'index.php/Baseweb/info_pelatihan';
            $config['first_url'] = base_url() . 'index.php/Baseweb/info_pelatihan';
        }

        $config['per_page'] = 5;
        $config['page_query_string'] = TRUE;
        $config['total_rows'] = $this->Baseweb->total_rows_info_pelatihan($q);
        $info_pelatihan = $this->Baseweb->get_limit_data_info_pelatihan($config['per_page'], $start, $q);
        $config['full_tag_open'] = '<ul class="pagination" role="navigation">';
        $config['full_tag_close'] = '</ul>';
        $config['first_link'] = 'Awal';
        $config['first_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['first_tag_close'] = '</span></li>';
        $config['last_link'] = 'Akhir';
        $config['last_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['last_tag_close'] = '</span></li>';
        $config['next_link'] = '&raquo;';
        $config['next_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['next_tag_close'] = '</span></li>';
        $config['prev_link'] = '&laquo;';
        $config['prev_tag_open'] = '<li class="page-item"><span class="page-link" aria-hidden="true">';
        $config['prev_tag_close'] = '</span></li>';
        $config['cur_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['cur_tag_close'] = '</span></li>';
        $config['num_tag_open'] = '<li class="page-item"><span class="page-link">';
        $config['num_tag_close'] = '</span></li>';
        $this->load->library('pagination');
        $this->pagination->initialize($config);

        $data = array(
            'info_pelatihan' => $info_pelatihan,
            'q' => $q,
            'pagination' => $this->pagination->create_links(),
            'total_rows' => $config['total_rows'],
            'start' => $start,
        );
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_info_pelatihan', $data);
    }

    function visi_misi()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['visi_misi'] = $this->Baseweb->getProfil(1);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_visi_misi', $data);
    }

    function struktur_organisasi()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));
        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['struktur'] = $this->Baseweb->getProfil(2);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_struktur', $data);
    }

    function sejarah()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['sejarah'] = $this->Baseweb->getProfil(3);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_sejarah', $data);
    }

    function tupoksi()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['tupoksi'] = $this->Baseweb->getProfil(4);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_tupoksi', $data);
    }

    function profil_pimpinan()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['profil_pimpinan'] = $this->Baseweb->getProfil(5);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_profil_pimpinan', $data);
    }

    function komposisi_pegawai()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['berita_terkini'] = $this->Baseweb->getBeritaTerkini();
        $data['berita_terbaru'] = $this->Baseweb->getBerita();
        $data['komposisi_pegawai'] = $this->Baseweb->getProfil(6);

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_komposisi_pegawai', $data);
    }

    function LaporBencana()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_lapor_bencana', $data);
    }

    function SaranAduan()
    {
        $tahun = date('Y');
        $bulan = number_format(date('m'));
        $hari = number_format(date('d'));

        $data['total'] = $this->Baseweb->getTotal();
        $data['tahun_sekarang'] = $this->Baseweb->getTahunSekarang($tahun);
        $data['bulan_sekarang'] = $this->Baseweb->getBulanSekarang($tahun, $bulan);
        $data['hari_sekarang'] = $this->Baseweb->getHariSekarang($tahun, $bulan, $hari);

        $this->template->load('template_website', 'website/content_saran_aduan', $data);
    }

    function get_kabkota()
    {
        $provinsi_id = $this->input->post('kode_provinsi');
        $kabupaten = $this->Baseweb->get_kabkota($provinsi_id);
        echo json_encode($kabupaten);
    }

    function get_kecamatan()
    {
        $kabupaten_id = $this->input->post('kode_kabkota');
        $kecamatan = $this->Baseweb->get_kecamatan($kabupaten_id);
        echo json_encode($kecamatan);
    }

    function get_desa_kelurahan()
    {
        $kelurahan_id = $this->input->post('kode_kecamatan');
        $kelurahan = $this->Baseweb->getKelurhanDesa($kelurahan_id);
        echo json_encode($kelurahan);
    }
}
